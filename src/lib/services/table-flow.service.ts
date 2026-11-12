/**
 * Table Flow Service — Merkezi Masa Yaşam Döngüsü Yönetimi
 *
 * Tüm masa durumu değişiklikleri bu servis üzerinden yapılır.
 * Her fonksiyon Prisma transaction kullanır.
 * İdempotent tasarım: aynı işlem 2 kez yapılsa bile bozulmaz.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import type { BillPaymentStatus, PaymentStatus, Prisma, RequestStatus, TableStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { writeTableStatus, type TableChangeCause, type TableEventReason } from "@/lib/services/table-events.service";
import { BILLABLE_ORDER_STATUSES, computeClosedTableStatus, computeOpenTableStatus } from "@/lib/services/table-status";

// ═══════════════════════════════════════════════════════════════════════════
// 1. MASA AÇMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masayı açar: Table → OCCUPIED, yeni TableSession + Bill oluşturur.
 * İdempotent: Zaten aktif session varsa mevcut olanı döner.
 *
 * Eşzamanlı iki çağrı aynı anda "aktif oturum yok" görebilir; ikinci oturumu
 * table_sessions_unique_active_per_table indeksi reddeder (P2002) ve o transaction
 * geri alınır. Bir kez yeniden denenince kazananın oturumu isNew: false ile döner.
 */
export async function openTable(tableId: string, businessId: string, cause: TableChangeCause) {
  try {
    return await openTableOnce(tableId, businessId, cause);
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    return openTableOnce(tableId, businessId, cause);
  }
}

async function openTableOnce(tableId: string, businessId: string, cause: TableChangeCause) {
  return prisma.$transaction(async (tx) => {
    // Masa kontrolü
    const table = await tx.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });
    if (!table) throw new Error("Masa bulunamadı veya aktif değil");

    // Zaten aktif session var mı? (idempotent)
    const existing = await tx.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (existing) {
      return { tableSession: existing, bill: existing.bill, isNew: false };
    }

    // Yeni session oluştur
    const tableSession = await tx.tableSession.create({
      data: {
        businessId,
        tableId,
        status: "ACTIVE",
      },
    });

    // Yeni bill oluştur
    const bill = await tx.bill.create({
      data: {
        businessId,
        tableId,
        tableSessionId: tableSession.id,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: "UNPAID",
        status: "OPEN",
      },
    });

    await writeTableStatus(tx, { businessId, tableId }, "OCCUPIED", cause);

    return { tableSession: { ...tableSession, bill }, bill, isNew: true };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. AKTİF SESSION GETIR / OLUŞTUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bir masa için aktif session'ı getirir.
 * Yoksa null döner.
 */
export async function getActiveTableSession(tableId: string, businessId: string) {
  return prisma.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: { bill: true },
  });
}

/**
 * Transaction client ile aktif session getirir (transaction içinde kullanım için).
 */
async function getActiveSessionTx(tx: Prisma.TransactionClient, tableId: string, businessId: string) {
  return tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: { bill: true },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. AÇIK BILL GETIR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aktif session'ın açık adisyonunu getirir.
 */
export async function getOpenBill(tableSessionId: string) {
  return prisma.bill.findFirst({
    where: { tableSessionId, status: "OPEN" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SİPARİŞ SONRASI BILL GÜNCELLEME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sipariş garson onayından geçtikten sonra bill.totalAmount ve remainingAmount günceller.
 * Transaction client alır (dış transaction içinden çağrılır).
 */
export async function updateBillAfterOrder(tx: Prisma.TransactionClient, tableSessionId: string) {
  const bill = await tx.bill.findFirst({
    where: { tableSessionId, status: "OPEN" },
  });
  if (!bill) return null;

  // Sadece ödenebilir siparişlerin toplamı (onay bekleyen sipariş borç yazmaz)
  const orders = await tx.order.findMany({
    where: {
      tableSessionId,
      status: { in: BILLABLE_ORDER_STATUSES },
    },
  });

  const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
  const remainingAmount = Math.max(0, totalAmount - Number(bill.paidAmount));

  let paymentStatus: BillPaymentStatus = "UNPAID";
  if (remainingAmount === 0 && totalAmount > 0) paymentStatus = "PAID";
  else if (Number(bill.paidAmount) > 0) paymentStatus = "PARTIALLY_PAID";

  return tx.bill.update({
    where: { id: bill.id },
    data: { totalAmount, remainingAmount, paymentStatus },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. ÖDEME TALEBİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ödeme talebi oluşturur — transaction ile.
 * Dönen: { payment, serviceRequest, table }
 */
export async function requestPayment(
  tableId: string,
  businessId: string,
  note: string | null = null,
  customerSessionId: string | null = null
) {
  return prisma.$transaction(async (tx) => {
    // Masa kontrolü
    const table = await tx.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });
    if (!table) throw new Error("Masa bulunamadı");

    if (table.status === "EMPTY") {
      throw new Error("Boş masadan ödeme talebi gönderilemez");
    }

    // Aktif session
    const activeSession = await getActiveSessionTx(tx, tableId, businessId);
    if (!activeSession) throw new Error("Bu masada aktif bir oturum bulunmamaktadır.");

    // Bill kontrolü
    const bill = activeSession.bill;
    if (!bill) throw new Error("Adisyon bulunamadı");

    // Ödenecek sipariş var mı? (onay bekleyen sipariş borç sayılmaz)
    const payableOrders = await tx.order.findMany({
      where: {
        tableSessionId: activeSession.id,
        status: { in: BILLABLE_ORDER_STATUSES },
      },
    });
    if (payableOrders.length === 0) {
      throw new Error("Ödenecek aktif sipariş bulunmamaktadır.");
    }

    // Zaten bekleyen ödeme talebi var mı?
    const existingPayment = await tx.payment.findFirst({
      where: {
        businessId,
        tableSessionId: activeSession.id,
        status: { in: ["PENDING", "AWAITING_ADMIN_APPROVAL", "PROCESSING"] },
      },
    });
    if (existingPayment) {
      throw new Error("Zaten bekleyen bir ödeme talebiniz var.");
    }

    // Toplam sipariş tutarını server-side hesapla (Decimal)
    const orderTotalDecimal = payableOrders.reduce(
      (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
      new Decimal(0)
    );

    // Daha önce ödenmiş tutarları topla
    const existingPaidPayments = await tx.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });

    const paidTotalDecimal = existingPaidPayments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount.toString())),
      new Decimal(0)
    );

    // Gerçek kalan borç
    const remainingDueDecimal = Decimal.max(new Decimal(0), orderTotalDecimal.sub(paidTotalDecimal));
    const remainingDue = remainingDueDecimal.toNumber();

    if (remainingDue <= 0) {
      throw new Error("Ödenecek kalan borç bulunmamaktadır.");
    }

    // Payment kaydı
    const payment = await tx.payment.create({
      data: {
        businessId,
        tableId,
        tableSessionId: activeSession.id,
        billId: bill.id,
        amount: remainingDueDecimal,
        status: "PENDING",
        note,
      },
    });

    // Service request
    const serviceRequest = await tx.serviceRequest.create({
      data: {
        businessId,
        tableId,
        requestType: "PAYMENT_REQUEST",
        note,
        status: "PENDING",
      },
    });

    await recalculateTableStatus(tx, { businessId, tableId }, { source: "CUSTOMER", reason: "PAYMENT_REQUESTED", customerSessionId });

    // Bildirim
    const message = `${table.tableName || "Masa " + table.tableNumber} ödeme istiyor (₺${remainingDue.toFixed(2)})`;
    await tx.notification.create({
      data: {
        businessId,
        tableId,
        type: "PAYMENT_REQUEST",
        title: "Ödeme Talebi",
        message,
        soundType: "PAYMENT",
      },
    });

    return { payment, serviceRequest, table, totalAmount: remainingDue, message };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6b. ADMİN ÖDEME İŞLEMİ (MERKEZİ)
// ═══════════════════════════════════════════════════════════════════════════

export { PaymentError, processAdminPayment } from "@/lib/services/payment.service";

export interface AdminPaymentInput {
  billId: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
  adminId: string;
  adminName: string;
  businessId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. MASA KAPATMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masayı kapatır — tüm ilişkili kayıtları tek transaction ile kapatır.
 *
 * Güvenlik kuralları (forceClose=false):
 *   1. Tüm siparişler COMPLETED, CANCELLED veya REJECTED olmalıdır.
 *   2. Kalan bakiye 0 ₺ olmalıdır (Decimal hassasiyetle hesaplanır).
 *
 * forceClose=true durumunda aktif siparişler otomatik iptal edilir.
 */
export class TableCloseError extends Error {
  constructor(
    public readonly code: "SESSION_NOT_FOUND" | "UNFINISHED_ORDERS" | "UNPAID_BALANCE",
    message: string,
    public readonly unfinishedOrderCount = 0
  ) {
    super(message);
    this.name = "TableCloseError";
  }
}

export async function closeTable(
  tableSessionId: string,
  businessId: string,
  /** null: sistem kapattı (ör. boşta kalan demo masası) */
  closedById: string | null,
  options: { forceClose?: boolean; closeReason?: string; eventReason?: TableEventReason } = {}
) {
  const { forceClose = false, closeReason } = options;

  return prisma.$transaction(async (tx) => {
    // Oturum kontrolü
    const tableSession = await tx.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });
    if (!tableSession) throw new TableCloseError("SESSION_NOT_FOUND", "Aktif oturum bulunamadı");

    // ✅ Tamamlanmamış sipariş kontrolü (PENDING, ACCEPTED, PREPARING, SERVED dahil)
    const unfinishedOrders = await tx.order.findMany({
      where: {
        tableSessionId: tableSession.id,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING", "SERVED"] },
      },
      select: { id: true, status: true },
    });

    if (unfinishedOrders.length > 0 && !forceClose) {
      const statusCounts: Record<string, number> = {};
      unfinishedOrders.forEach((o) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });
      const summary = Object.entries(statusCounts)
        .map(([s, c]) => `${c} ${s}`)
        .join(", ");
      throw new TableCloseError(
        "UNFINISHED_ORDERS",
        `Masada tamamlanmamış siparişler var (${summary}). Tüm siparişler tamamlanmalı veya iptal edilmelidir. Zorla kapatmak için forceClose kullanın.`,
        unfinishedOrders.length
      );
    }

    // ✅ forceClose: Tamamlanmamış siparişleri otomatik iptal et
    if (unfinishedOrders.length > 0 && forceClose) {
      await tx.order.updateMany({
        where: {
          tableSessionId: tableSession.id,
          status: { in: ["PENDING", "ACCEPTED", "PREPARING", "SERVED"] },
        },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelReason: closeReason || "Masa kapatıldığı için otomatik iptal edildi",
          cancelledAt: new Date(),
          cancelledById: closedById,
        },
      });
    }

    // ✅ Ödenmemiş hesap kontrolü — Decimal ile server-side yeniden hesapla
    const bill = tableSession.bill;
    if (bill) {
      const orders = await tx.order.findMany({
        where: {
          tableSessionId: tableSession.id,
          status: { in: BILLABLE_ORDER_STATUSES },
        },
        select: { totalPrice: true },
      });
      const serverTotal = orders.reduce(
        (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
        new Decimal(0)
      );
      const paidPayments = await tx.payment.findMany({
        where: { billId: bill.id, status: "PAID" },
        select: { amount: true },
      });
      const paidTotal = paidPayments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount.toString())),
        new Decimal(0)
      );
      const remaining = Decimal.max(new Decimal(0), serverTotal.sub(paidTotal));

      if (remaining.greaterThan(new Decimal(0)) && !forceClose) {
        throw new TableCloseError(
          "UNPAID_BALANCE",
          `Bu masa kapatılamaz. Ödenmemiş hesap var: ${remaining.toFixed(2)} ₺`
        );
      }
    }

    // 1. Session kapat
    await tx.tableSession.update({
      where: { id: tableSessionId },
      data: {
        status: "CLOSED",
        endedAt: new Date(),
        closedById,
        closeReason: forceClose ? (closeReason || "Admin tarafından kapatıldı") : null,
      },
    });

    // 2. Bill kapat
    if (bill) {
      // Server-side hesaplanan kalan borcu kullan
      const orders = await tx.order.findMany({
        where: {
          tableSessionId: tableSession.id,
          status: { in: BILLABLE_ORDER_STATUSES },
        },
        select: { totalPrice: true },
      });
      const serverTotal = orders.reduce(
        (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
        new Decimal(0)
      );
      const paidPayments = await tx.payment.findMany({
        where: { billId: bill.id, status: "PAID" },
        select: { amount: true },
      });
      const paidTotal = paidPayments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount.toString())),
        new Decimal(0)
      );
      const remaining = Decimal.max(new Decimal(0), serverTotal.sub(paidTotal));

      await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          totalAmount: serverTotal,
          paidAmount: paidTotal,
          remainingAmount: remaining,
          paymentStatus:
            remaining.isZero()
              ? "PAID"
              : forceClose
                ? "CANCELLED"
                : bill.paymentStatus,
        },
      });
    }

    // 3. Masa EMPTY yap (qrToken korunur)
    await writeTableStatus(tx, { businessId, tableId: tableSession.tableId }, "EMPTY", {
      source: closedById ? "STAFF" : "SYSTEM",
      reason: options.eventReason ?? (forceClose ? "TABLE_FORCE_CLOSED" : "TABLE_CLOSED"),
      actorUserId: closedById,
    });

    // 4. CustomerSession kayıtlarını kapat ve yetkilerini iptal et
    await tx.customerSession.updateMany({
      where: {
        tableId: tableSession.tableId,
        businessId,
        status: "ACTIVE",
      },
      data: { status: "CLOSED", authorizationStatus: "REVOKED", closedAt: new Date() },
    });

    // 5. Açık hizmet taleplerini tamamla (ORDER_REQUEST dahil)
    await tx.serviceRequest.updateMany({
      where: {
        tableId: tableSession.tableId,
        status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
      },
      data: { status: "CANCELLED" },
    });

    // 6. Okunmamış bildirimleri okundu yap
    await tx.notification.updateMany({
      where: {
        tableId: tableSession.tableId,
        businessId,
        isRead: false,
      },
      data: { isRead: true },
    });

    // 7. Bekleyen ödeme taleplerini iptal et
    await tx.payment.updateMany({
      where: {
        tableSessionId: tableSession.id,
        status: { in: ["PENDING", "AWAITING_ADMIN_APPROVAL", "PROCESSING"] },
      },
      data: { status: "CANCELLED" },
    });

    return { success: true };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. MASA DURUMUNU KAYITLARDAN HESAPLA
// ═══════════════════════════════════════════════════════════════════════════

const OPEN_REQUEST_STATUSES: RequestStatus[] = ["PENDING", "SEEN", "IN_PROGRESS"];
const OPEN_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "AWAITING_ADMIN_APPROVAL", "PROCESSING"];

/**
 * Masa durumunun tek hesaplayıcısı: kuralları table-status.ts'te. Dış transaction içinden çağrılır,
 * hesaplanan durumu yazar ve döndürür. Masa açma ve kapatma dışındaki her değişiklik buradan geçer.
 */
export async function recalculateTableStatus(
  tx: Prisma.TransactionClient,
  opts: { businessId: string; tableId: string },
  cause: TableChangeCause
): Promise<TableStatus> {
  const { businessId, tableId } = opts;

  const table = await tx.table.findFirst({
    where: { id: tableId, businessId },
    select: { status: true },
  });
  if (!table) throw new Error("Masa bulunamadı");

  const activeSession = await tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: { bill: true },
  });

  let computed: TableStatus;
  if (activeSession) {
    const [orders, paymentRequests, openPayments, waiterCalls] = await Promise.all([
      tx.order.findMany({
        where: { tableSessionId: activeSession.id, status: { in: BILLABLE_ORDER_STATUSES } },
        select: { status: true },
        distinct: ["status"],
      }),
      tx.serviceRequest.count({
        where: { tableId, businessId, requestType: "PAYMENT_REQUEST", status: { in: OPEN_REQUEST_STATUSES } },
      }),
      tx.payment.count({
        where: { tableSessionId: activeSession.id, status: { in: OPEN_PAYMENT_STATUSES } },
      }),
      tx.serviceRequest.count({
        where: { tableId, businessId, requestType: "CALL_WAITER", status: { in: OPEN_REQUEST_STATUSES } },
      }),
    ]);

    const hasDebt = Number(activeSession.bill?.remainingAmount ?? 0) > 0;
    computed = computeOpenTableStatus({
      orderStatuses: orders.map((order) => order.status),
      hasPaymentRequest: hasDebt && (paymentRequests > 0 || openPayments > 0),
      hasWaiterCall: waiterCalls > 0,
    });
  } else {
    const openBill = await tx.bill.count({ where: { tableId, businessId, status: "OPEN" } });
    computed = computeClosedTableStatus(table.status, openBill > 0);
  }

  return writeTableStatus(tx, { businessId, tableId }, computed, cause);
}
