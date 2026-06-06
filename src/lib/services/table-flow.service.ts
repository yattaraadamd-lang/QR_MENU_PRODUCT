/**
 * Table Flow Service — Merkezi Masa Yaşam Döngüsü Yönetimi
 *
 * Tüm masa durumu değişiklikleri bu servis üzerinden yapılır.
 * Her fonksiyon Prisma transaction kullanır.
 * İdempotent tasarım: aynı işlem 2 kez yapılsa bile bozulmaz.
 */

import { prisma } from "@/lib/prisma";
import { TableStatus, TableSessionStatus, BillStatus, BillPaymentStatus, RequestStatus, PaymentStatus } from "@prisma/client";
import type { PrismaClient, Prisma } from "@prisma/client";

// Transaction client tipi
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Geçerli Masa Durumu Geçişleri ─────────────────────────────────────────
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  EMPTY:             ["OCCUPIED"],
  OCCUPIED:          ["HAS_ORDER", "WAITING_WAITER", "EMPTY"],
  HAS_ORDER:         ["PREPARING", "WAITING_WAITER", "PAYMENT_REQUESTED", "SERVED", "OCCUPIED"],
  PREPARING:         ["SERVED", "WAITING_WAITER", "PAYMENT_REQUESTED", "HAS_ORDER"],
  SERVED:            ["PAYMENT_REQUESTED", "WAITING_WAITER", "CLEANING_NEEDED", "EMPTY", "HAS_ORDER"],
  WAITING_WAITER:    ["OCCUPIED", "HAS_ORDER", "PREPARING", "SERVED", "PAYMENT_REQUESTED", "EMPTY"],
  PAYMENT_REQUESTED: ["SERVED", "CLEANING_NEEDED", "EMPTY", "WAITING_WAITER"],
  CLEANING_NEEDED:   ["EMPTY"],
};

/**
 * Masa durumu geçişinin geçerli olup olmadığını kontrol eder.
 * forceClose=true durumunda her zaman izin verir.
 */
function isValidTransition(from: string, to: string, force = false): boolean {
  if (force) return true;
  if (from === to) return true; // Aynı duruma geçiş her zaman ok
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. MASA AÇMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masayı açar: Table → OCCUPIED, yeni TableSession + Bill oluşturur.
 * İdempotent: Zaten aktif session varsa mevcut olanı döner.
 */
export async function openTable(tableId: string, businessId: string) {
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

    // Masa durumunu OCCUPIED yap
    await tx.table.update({
      where: { id: tableId },
      data: { status: "OCCUPIED" },
    });

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
async function getActiveSessionTx(tx: TxClient, tableId: string, businessId: string) {
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
 * Sipariş oluşturulduktan sonra bill.totalAmount ve remainingAmount günceller.
 * Transaction client alır (dış transaction içinden çağrılır).
 */
export async function updateBillAfterOrder(tx: TxClient, tableSessionId: string) {
  const bill = await tx.bill.findFirst({
    where: { tableSessionId, status: "OPEN" },
  });
  if (!bill) return null;

  // Sadece ödenebilir siparişlerin toplamı
  const orders = await tx.order.findMany({
    where: {
      tableSessionId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
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

/**
 * Masa durumunu sipariş durumuna göre senkronize eder.
 * Transaction client alır.
 */
export async function syncTableStatusAfterOrder(tx: TxClient, tableId: string, businessId: string) {
  const activeSession = await tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
  });
  if (!activeSession) return;

  const table = await tx.table.findUnique({ where: { id: tableId } });
  if (!table) return;

  // Masa durumu zaten PAYMENT_REQUESTED veya WAITING_WAITER ise dokunma
  if (table.status === "PAYMENT_REQUESTED" || table.status === "WAITING_WAITER") {
    return;
  }

  // Aktif sipariş var mı?
  const pendingOrders = await tx.order.count({
    where: {
      tableSessionId: activeSession.id,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
  });

  const preparingOrders = await tx.order.count({
    where: {
      tableSessionId: activeSession.id,
      status: "PREPARING",
    },
  });

  let newStatus: TableStatus = table.status;
  if (pendingOrders > 0 || preparingOrders > 0) {
    newStatus = "HAS_ORDER";
  }

  if (newStatus !== table.status) {
    await tx.table.update({
      where: { id: tableId },
      data: { status: newStatus },
    });
  }
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
  note: string | null = null
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

    // Ödenecek sipariş var mı?
    const payableOrders = await tx.order.findMany({
      where: {
        tableSessionId: activeSession.id,
        status: { in: ["SERVED", "ACCEPTED", "PREPARING", "PENDING"] },
      },
    });
    if (payableOrders.length === 0) {
      throw new Error("Ödenecek aktif sipariş bulunmamaktadır.");
    }

    // Zaten bekleyen ödeme talebi var mı?
    const existingPayment = await tx.payment.findFirst({
      where: { tableId, businessId, status: "PENDING" },
    });
    if (existingPayment) {
      throw new Error("Zaten bekleyen bir ödeme talebiniz var.");
    }

    // Toplam tutarı server-side hesapla
    const totalAmount = payableOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    // Payment kaydı
    const payment = await tx.payment.create({
      data: {
        businessId,
        tableId,
        tableSessionId: activeSession.id,
        billId: bill.id,
        amount: totalAmount,
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

    // Masa durumunu güncelle
    await tx.table.update({
      where: { id: tableId },
      data: { status: "PAYMENT_REQUESTED" },
    });

    // Bildirim
    const message = `${table.tableName || "Masa " + table.tableNumber} ödeme istiyor (₺${totalAmount.toFixed(2)})`;
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

    return { payment, serviceRequest, table, totalAmount, message };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ÖDEME ALMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Garson ödeme alır — transaction ile bill günceller.
 */
export async function collectPayment(
  tableSessionId: string,
  businessId: string,
  amount: number,
  method: string,
  handledById: string,
  handledByWaiterName: string,
  note: string | null = null
) {
  return prisma.$transaction(async (tx) => {
    // Oturum kontrolü
    const tableSession = await tx.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true, table: true },
    });
    if (!tableSession) throw new Error("Aktif oturum bulunamadı");

    const bill = tableSession.bill;
    if (!bill) throw new Error("Adisyon bulunamadı");

    // Bill totalAmount'u server-side yeniden hesapla
    const orders = await tx.order.findMany({
      where: {
        tableSessionId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    const serverTotalAmount = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    // Bill totalAmount'u güncelle (her zaman server-side hesaplanan değer)
    // Ödeme kaydı oluştur
    const payment = await tx.payment.create({
      data: {
        businessId,
        tableId: tableSession.tableId,
        tableSessionId,
        billId: bill.id,
        amount,
        method: method as any,
        note,
        status: "PAID",
        paidAt: new Date(),
        handledById,
        handledByWaiterName,
      },
    });

    // Tüm ödemeleri topla
    const allPayments = await tx.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });
    const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const remainingAmount = Math.max(0, serverTotalAmount - paidAmount);

    let paymentStatus: BillPaymentStatus = "UNPAID";
    if (remainingAmount === 0 && serverTotalAmount > 0) paymentStatus = "PAID";
    else if (paidAmount > 0) paymentStatus = "PARTIALLY_PAID";

    const updatedBill = await tx.bill.update({
      where: { id: bill.id },
      data: {
        totalAmount: serverTotalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus,
      },
    });

    // Tam ödeme yapıldıysa masa durumunu güncelle
    if (paymentStatus === "PAID") {
      await tx.table.update({
        where: { id: tableSession.tableId },
        data: { status: "SERVED" },
      });
    }

    return { payment, bill: updatedBill, table: tableSession.table };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. MASA KAPATMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masayı kapatır — tüm ilişkili kayıtları tek transaction ile kapatır.
 */
export async function closeTable(
  tableSessionId: string,
  businessId: string,
  closedById: string,
  options: { forceClose?: boolean; closeReason?: string } = {}
) {
  const { forceClose = false, closeReason } = options;

  return prisma.$transaction(async (tx) => {
    // Oturum kontrolü
    const tableSession = await tx.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });
    if (!tableSession) throw new Error("Aktif oturum bulunamadı");

    // Aktif sipariş kontrolü
    const activeOrders = await tx.order.count({
      where: {
        tableSessionId: tableSession.id,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
    });

    if (activeOrders > 0 && !forceClose) {
      throw new Error(
        `Masada ${activeOrders} aktif sipariş var. Zorla kapatmak için forceClose kullanın.`
      );
    }

    // Ödenmemiş hesap kontrolü
    const bill = tableSession.bill;
    if (bill && Number(bill.remainingAmount) > 0 && !forceClose) {
      throw new Error(
        `Bu masa kapatılamaz. Ödenmemiş hesap var: ${Number(bill.remainingAmount).toFixed(2)} ₺`
      );
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
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          paymentStatus:
            Number(bill.remainingAmount) <= 0
              ? "PAID"
              : forceClose
                ? "CANCELLED"
                : bill.paymentStatus,
        },
      });
    }

    // 3. Masa EMPTY yap (qrToken korunur)
    await tx.table.update({
      where: { id: tableSession.tableId },
      data: { status: "EMPTY" },
    });

    // 4. CustomerSession kayıtlarını kapat
    await tx.customerSession.updateMany({
      where: {
        tableId: tableSession.tableId,
        businessId,
        status: "ACTIVE",
      },
      data: { status: "CLOSED" },
    });

    // 5. Açık hizmet taleplerini tamamla
    await tx.serviceRequest.updateMany({
      where: {
        tableId: tableSession.tableId,
        status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
      },
      data: { status: "COMPLETED", completedAt: new Date() },
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
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    return { success: true };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. YARDIMCI: MASA DURUMUNU SENKRONIZE ET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masanın mevcut durumunu ilişkili verilerden yeniden hesaplar.
 * Tutarsızlık durumlarında düzeltme yapar.
 */
export async function syncTableStatus(tableId: string, businessId: string) {
  return prisma.$transaction(async (tx) => {
    const table = await tx.table.findFirst({
      where: { id: tableId, businessId },
    });
    if (!table) return null;

    const activeSession = await tx.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    // Aktif session yoksa masa EMPTY olmalı
    if (!activeSession) {
      if (table.status !== "EMPTY" && table.status !== "CLEANING_NEEDED") {
        await tx.table.update({
          where: { id: tableId },
          data: { status: "EMPTY" },
        });
      }
      return { status: "EMPTY" };
    }

    // Bekleyen ödeme talebi var mı?
    const pendingPayment = await tx.payment.findFirst({
      where: { tableSessionId: activeSession.id, status: "PENDING" },
    });
    if (pendingPayment) {
      if (table.status !== "PAYMENT_REQUESTED") {
        await tx.table.update({
          where: { id: tableId },
          data: { status: "PAYMENT_REQUESTED" },
        });
      }
      return { status: "PAYMENT_REQUESTED" };
    }

    // Garson çağrısı var mı?
    const waitingWaiter = await tx.serviceRequest.findFirst({
      where: {
        tableId,
        requestType: "CALL_WAITER",
        status: { in: ["PENDING", "SEEN"] },
      },
    });
    if (waitingWaiter) {
      if (table.status !== "WAITING_WAITER") {
        await tx.table.update({
          where: { id: tableId },
          data: { status: "WAITING_WAITER" },
        });
      }
      return { status: "WAITING_WAITER" };
    }

    // Sipariş durumlarına göre
    const orderStatuses = await tx.order.groupBy({
      by: ["status"],
      where: {
        tableSessionId: activeSession.id,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      _count: true,
    });

    const statusMap: Record<string, number> = {};
    orderStatuses.forEach((s) => {
      statusMap[s.status] = s._count;
    });

    let computedStatus: TableStatus = "OCCUPIED";
    if (statusMap["PREPARING"]) computedStatus = "PREPARING";
    else if (statusMap["PENDING"] || statusMap["ACCEPTED"]) computedStatus = "HAS_ORDER";
    else if (statusMap["SERVED"]) computedStatus = "SERVED";

    if (table.status !== computedStatus) {
      await tx.table.update({
        where: { id: tableId },
        data: { status: computedStatus },
      });
    }

    return { status: computedStatus };
  });
}
