/**
 * Order Cancellation Service — Merkezi Sipariş İptal/Red Yönetimi
 *
 * Tüm sipariş iptal ve ret işlemleri bu servis üzerinden yapılır.
 * Tek transaction içinde:
 *   1. Sipariş durumu güncelleme
 *   2. Stok güncellemesi (OUT_OF_STOCK)
 *   3. Bill yeniden hesaplama
 *   4. Masa durumu derivasyonu
 *   5. Ödeme talebi temizleme
 *
 * Transaction sonrası socket emit yapılır; socket hatası DB'yi geri almaz.
 */

import { prisma } from "@/lib/prisma";
import { OrderStatus, OrderCancelReasonCode, TableStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { deriveTableStatusAfterOrderChange } from "@/lib/services/table-flow.service";
import { emitToBusinessRoom, SOCKET_EVENTS } from "@/lib/socket-server";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";

// Transaction client tipi
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Error sınıfı ────────────────────────────────────────────────────────
export class OrderCancellationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "OrderCancellationError";
  }
}

// ─── Input tipi ──────────────────────────────────────────────────────────
export type CancelOrderInput = {
  orderId: string;
  businessId: string;
  actorId: string;
  actorRole: "WAITER" | "ADMIN" | "SUPER_ADMIN";
  targetStatus: "CANCELLED" | "REJECTED";
  reasonCode?: OrderCancelReasonCode | null;
  reasonText?: string | null;
  outOfStockProductIds?: string[] | null;
};

// ─── Sonuç tipi ──────────────────────────────────────────────────────────
export type CancelOrderResult = {
  order: any;
  tableStatus: TableStatus;
  stockUpdatedProductIds: string[];
  billUpdated: boolean;
};

// ─── İptal edilebilir sipariş durumları ──────────────────────────────────
const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
];

/**
 * Merkezi sipariş iptal/red fonksiyonu.
 * Tüm iptal/red endpointleri bu fonksiyonu çağırmalıdır.
 */
export async function cancelOrderAndSyncState(
  input: CancelOrderInput
): Promise<CancelOrderResult> {
  const {
    orderId,
    businessId,
    actorId,
    targetStatus,
    reasonCode,
    reasonText,
    outOfStockProductIds,
  } = input;

  // ── Ön doğrulama: OUT_OF_STOCK gönderilmişse reasonCode de OUT_OF_STOCK olmalı
  if (outOfStockProductIds && outOfStockProductIds.length > 0 && reasonCode !== "OUT_OF_STOCK") {
    throw new OrderCancellationError(
      "outOfStockProductIds yalnız reasonCode=OUT_OF_STOCK ile gönderilebilir.",
      "INVALID_CANCEL_REASON",
      400
    );
  }

  // ── Ön doğrulama: OUT_OF_STOCK seçilmiş ama ürün listesi boşsa
  if (reasonCode === "OUT_OF_STOCK" && (!outOfStockProductIds || outOfStockProductIds.length === 0)) {
    throw new OrderCancellationError(
      "Stokta yok nedeni seçildi ancak stok dışı yapılacak ürün belirtilmedi.",
      "OUT_OF_STOCK_PRODUCT_REQUIRED",
      400
    );
  }

  // ── Ön doğrulama: OTHER seçilmiş ama metin yoksa
  if (reasonCode === "OTHER" && (!reasonText || !reasonText.trim())) {
    throw new OrderCancellationError(
      "\"Diğer\" nedeni seçildiğinde açıklama zorunludur.",
      "INVALID_CANCEL_REASON",
      400
    );
  }

  // ── Ön doğrulama: Duplicate product IDs
  if (outOfStockProductIds && outOfStockProductIds.length > 0) {
    const unique = new Set(outOfStockProductIds);
    if (unique.size !== outOfStockProductIds.length) {
      throw new OrderCancellationError(
        "Aynı ürün ID birden fazla kez gönderilemez.",
        "INVALID_OUT_OF_STOCK_PRODUCT_SELECTION",
        400
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION
  // ═══════════════════════════════════════════════════════════════════════
  const result = await prisma.$transaction(
    async (tx) => {
      // ── 1. Siparişi getir ─────────────────────────────────────────────
      const order = await tx.order.findFirst({
        where: { id: orderId, businessId },
        include: {
          items: {
            select: {
              productId: true,
              productName: true,
            },
          },
          table: {
            select: {
              id: true,
              status: true,
              tableNumber: true,
              tableName: true,
            },
          },
        },
      });

      if (!order) {
        throw new OrderCancellationError(
          "Sipariş bulunamadı.",
          "ORDER_NOT_FOUND",
          404
        );
      }

      // ── 2. Durum geçişini doğrula ────────────────────────────────────
      // Zaten iptal/red edilmiş siparişi kontrol et
      if (order.status === "CANCELLED" || order.status === "REJECTED") {
        throw new OrderCancellationError(
          `Bu sipariş zaten "${order.status}" durumunda.`,
          "ORDER_NOT_CANCELLABLE",
          409
        );
      }

      if (!CANCELLABLE_STATUSES.includes(order.status as OrderStatus)) {
        throw new OrderCancellationError(
          `"${order.status}" durumundaki sipariş iptal/reddedilemez.`,
          "ORDER_NOT_CANCELLABLE",
          409
        );
      }

      // ── 3. Koşullu atomik güncelleme (race condition koruması) ───────
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          businessId,
          status: { in: CANCELLABLE_STATUSES },
        },
        data: {
          status: targetStatus,
          paymentStatus: "CANCELLED",
          cancelReason: reasonText || (targetStatus === "REJECTED"
            ? "Garson tarafından reddedildi"
            : "İptal edildi"),
          cancelReasonCode: reasonCode || null,
          cancelledAt: new Date(),
          cancelledById: actorId,
        },
      });

      if (updateResult.count !== 1) {
        // Siparişi yeniden oku — zaten iptal mi yoksa geçersiz geçiş mi?
        const recheckOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        if (recheckOrder && (recheckOrder.status === "CANCELLED" || recheckOrder.status === "REJECTED")) {
          throw new OrderCancellationError(
            "Siparişin durumu başka bir işlem tarafından zaten değiştirilmiş.",
            "ORDER_STATE_CHANGED",
            409
          );
        }

        throw new OrderCancellationError(
          "Sipariş durumu güncellenemedi. Lütfen tekrar deneyin.",
          "ORDER_STATE_CHANGED",
          409
        );
      }

      // ── 4. Stokta yok ürünlerini güncelle ────────────────────────────
      let stockUpdatedIds: string[] = [];

      if (reasonCode === "OUT_OF_STOCK" && outOfStockProductIds && outOfStockProductIds.length > 0) {
        // Siparişteki benzersiz ürün ID'lerini çıkar
        const orderProductIds = [...new Set(order.items.map(item => item.productId))];

        // Her outOfStockProductId'nin siparişteki ürünlerden biri olduğunu doğrula
        for (const pid of outOfStockProductIds) {
          if (!orderProductIds.includes(pid)) {
            throw new OrderCancellationError(
              `Ürün "${pid}" bu siparişte bulunmuyor.`,
              "INVALID_OUT_OF_STOCK_PRODUCT_SELECTION",
              400
            );
          }
        }

        // Ürünlerin bu işletmeye ait ve silinmemiş olduğunu doğrula
        const validProducts = await tx.product.findMany({
          where: {
            id: { in: outOfStockProductIds },
            businessId,
            isDeleted: false,
          },
          select: { id: true, stockStatus: true },
        });

        if (validProducts.length !== outOfStockProductIds.length) {
          const validIds = new Set(validProducts.map(p => p.id));
          const invalidIds = outOfStockProductIds.filter(id => !validIds.has(id));
          throw new OrderCancellationError(
            `Şu ürünler bu işletmeye ait değil veya silinmiş: ${invalidIds.join(", ")}`,
            "INVALID_OUT_OF_STOCK_PRODUCT_SELECTION",
            403
          );
        }

        // Güncelleme — zaten OUT_OF_STOCK olanları da dahil et (idempotent)
        const stockUpdateResult = await tx.product.updateMany({
          where: {
            businessId,
            id: { in: outOfStockProductIds },
            isDeleted: false,
          },
          data: {
            stockStatus: "OUT_OF_STOCK",
            isAvailable: false,
          },
        });

        // Güncellenen sayı uyuşmalı
        if (stockUpdateResult.count !== outOfStockProductIds.length) {
          throw new OrderCancellationError(
            "Stok güncellemesi sırasında beklenmeyen sayıda ürün güncellendi.",
            "STOCK_UPDATE_FAILED",
            500
          );
        }

        stockUpdatedIds = outOfStockProductIds;

        // Güncellenen ID'leri siparişe kaydet
        await tx.order.update({
          where: { id: orderId },
          data: { stockUpdatedProductIds: stockUpdatedIds },
        });
      }

      // ── 5. Bill'i yeniden hesapla ────────────────────────────────────
      let billUpdated = false;
      const tableSessionId = order.tableSessionId;

      if (tableSessionId) {
        const bill = await tx.bill.findFirst({
          where: { tableSessionId, status: "OPEN" },
        });

        if (bill) {
          // Ödenebilir siparişleri topla (Decimal kullanarak)
          const payableOrders = await tx.order.findMany({
            where: {
              tableSessionId,
              status: { notIn: ["CANCELLED", "REJECTED"] },
            },
            select: { totalPrice: true },
          });

          const totalAmountDecimal = payableOrders.reduce(
            (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
            new Decimal(0)
          );

          // Mevcut PAID ödemelerin toplamı
          const paidPayments = await tx.payment.findMany({
            where: { billId: bill.id, status: "PAID" },
            select: { amount: true },
          });

          const paidAmountDecimal = paidPayments.reduce(
            (sum, p) => sum.add(new Decimal(p.amount.toString())),
            new Decimal(0)
          );

          const remainingDecimal = Decimal.max(
            new Decimal(0),
            totalAmountDecimal.sub(paidAmountDecimal)
          );

          // Bill durumunu belirle
          let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
          if (remainingDecimal.isZero() && totalAmountDecimal.greaterThan(new Decimal(0))) {
            paymentStatus = "PAID";
          } else if (paidAmountDecimal.greaterThan(new Decimal(0))) {
            paymentStatus = "PARTIALLY_PAID";
          }

          await tx.bill.update({
            where: { id: bill.id },
            data: {
              totalAmount: totalAmountDecimal,
              paidAmount: paidAmountDecimal,
              remainingAmount: remainingDecimal,
              paymentStatus,
            },
          });

          billUpdated = true;

          // ── 5b. Kalan borç sıfırsa ödeme taleplerini kapat ─────────
          if (remainingDecimal.isZero()) {
            // Açık ödeme taleplerini iptal et (PAID olanlar hariç)
            await tx.payment.updateMany({
              where: {
                tableSessionId,
                businessId,
                status: { in: ["PENDING", "AWAITING_ADMIN_APPROVAL", "PROCESSING"] },
              },
              data: {
                status: "CANCELLED",
                note: "Sipariş iptali nedeniyle kalan borç sıfır — otomatik iptal",
              },
            });

            // Açık ödeme hizmet taleplerini kapat
            await tx.serviceRequest.updateMany({
              where: {
                tableId: order.tableId,
                businessId,
                requestType: "PAYMENT_REQUEST",
                status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
              },
              data: {
                status: "CANCELLED",
                resolvedAt: new Date(),
              },
            });
          }
        }
      }

      // ── 6. Masa durumunu belirle ─────────────────────────────────────
      const newTableStatus = await deriveTableStatusAfterOrderChange(tx, {
        tableId: order.tableId,
        tableSessionId,
        businessId,
      });

      // ── 7. Güncellenen siparişi döndür ───────────────────────────────
      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
          table: {
            select: {
              tableNumber: true,
              tableName: true,
            },
          },
        },
      });

      if (!updatedOrder) {
        throw new OrderCancellationError(
          "Sipariş güncellendikten sonra bulunamadı.",
          "ORDER_NOT_FOUND",
          500
        );
      }

      return {
        order: updatedOrder,
        tableStatus: newTableStatus,
        stockUpdatedProductIds: stockUpdatedIds,
        billUpdated,
      };
    },
    {
      maxWait: 10_000,
      timeout: 15_000,
    }
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SOCKET OLAYLARI (Transaction başarılı — hata DB'yi geri almaz)
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const { order, tableStatus, stockUpdatedProductIds: updatedPids } = result;

    if (order) {
      // Sipariş durumu
      emitToBusinessRoom(businessId, SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
        orderId: order.id,
        tableNumber: order.table?.tableNumber,
        tableName: order.table?.tableName,
        status: targetStatus,
        tableStatus,
        cancelReasonCode: reasonCode,
        message: `${order.table?.tableName || "Masa " + order.table?.tableNumber} sipariş ${targetStatus === "REJECTED" ? "reddedildi" : "iptal edildi"}`,
      });

      // Masa durumu
      emitToBusinessRoom(businessId, SOCKET_EVENTS.TABLE_STATUS_UPDATE, {
        tableId: order.tableId,
        tableStatus,
      });

      // Bill güncellendi
      if (result.billUpdated) {
        emitToBusinessRoom(businessId, SOCKET_EVENTS.BILL_UPDATED, {
          tableSessionId: order.tableSessionId,
          sourceOrderId: orderId,
        });
      }
    }

    // Stok güncellemesi
    if (updatedPids.length > 0) {
      emitToBusinessRoom(businessId, SOCKET_EVENTS.PRODUCT_STOCK_UPDATED, {
        businessId,
        productIds: updatedPids,
        stockStatus: "OUT_OF_STOCK",
        isAvailable: false,
        sourceOrderId: orderId,
      });
    }

    // 🔒 Audit log (fire and forget)
    createAuditLog({
      businessId,
      actorUserId: actorId,
      actorRole: input.actorRole,
      action: targetStatus === "REJECTED" ? AuditActions.ORDER_REQUEST_REJECTED : AuditActions.ORDER_CANCELLED,
      entityType: "Order",
      entityId: orderId,
      metadata: {
        reasonCode,
        reasonText,
        outOfStockProductIds: updatedPids,
        tableId: order?.tableId,
        tableNumber: order?.table?.tableNumber,
      },
    });
  } catch (e) {
    console.error("[OrderCancellation] Socket/Audit emit hatası (DB işlemi başarılı):", e);
  }

  return result;
}
