/**
 * Table Flow Service — Merkezi Masa Yaşam Döngüsü Yönetimi
 *
 * Tüm masa durumu değişiklikleri bu servis üzerinden yapılır.
 * Her fonksiyon Prisma transaction kullanır.
 * İdempotent tasarım: aynı işlem 2 kez yapılsa bile bozulmaz.
 */

import { prisma } from "@/lib/prisma";
import { TableStatus, TableSessionStatus, BillStatus, BillPaymentStatus, RequestStatus, PaymentStatus, PaymentMethod } from "@prisma/client";
import type { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

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
 * 
 * @param amount - Garsonun girdiği tutar (validasyon için kullanılır)
 * @param receivedAmount - (Opsiyonel) Nakit ödemelerde müşteriden alınan fiziksel tutar
 */
export async function collectPayment(
  tableSessionId: string,
  businessId: string,
  amount: number,
  method: string,
  handledById: string,
  handledByWaiterName: string,
  note: string | null = null,
  receivedAmount: number | null = null
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

    // ✅ Bill totalAmount'u server-side yeniden hesapla
    const orders = await tx.order.findMany({
      where: {
        tableSessionId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    const serverTotalAmount = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    // ✅ Şimdiye kadar ödenen tutarı hesapla
    const existingPayments = await tx.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });
    const alreadyPaidAmount = existingPayments.reduce((s, p) => s + Number(p.amount), 0);
    
    // ✅ Kalan borç
    const remainingDue = Math.max(0, serverTotalAmount - alreadyPaidAmount);

    // ✅ CİROYA EKLENECEK TUTAR: En fazla kalan borç kadar olabilir
    // Garson yanlışlıkla fazla tutar girse bile ciroya sadece borç kadar eklenir
    const actualPaymentAmount = Math.min(amount, remainingDue);

    // ✅ Validasyon: Ödeme tutarı 0 olamaz
    if (actualPaymentAmount <= 0) {
      throw new Error("Ödeme tutarı 0 veya negatif olamaz. Kalan borç: ₺" + remainingDue.toFixed(2));
    }

    // ✅ Ödeme kaydı oluştur (actualPaymentAmount kullan, amount değil!)
    const payment = await tx.payment.create({
      data: {
        businessId,
        tableId: tableSession.tableId,
        tableSessionId,
        billId: bill.id,
        amount: actualPaymentAmount, // ✅ Ciroya bu tutar eklenir
        method: method as any,
        note,
        status: "PAID",
        paidAt: new Date(),
        handledById,
        handledByWaiterName,
      },
    });

    // ✅ Tüm ödemeleri topla (yeni ödeme dahil)
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
      
      // ✅ GÜVENLİK: Tam ödeme alındığında tüm CustomerSession'ları kapat ve yetkilerini iptal et
      await tx.customerSession.updateMany({
        where: {
          tableId: tableSession.tableId,
          businessId,
          status: "ACTIVE",
        },
        data: { status: "CLOSED", authorizationStatus: "REVOKED", closedAt: new Date() },
      });
    }

    return { payment, bill: updatedBill, table: tableSession.table };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6b. ADMİN ÖDEME İŞLEMİ (MERKEZİ)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Yapılandırılmış ödeme hatası — kod ve mesaj taşır.
 */
export class PaymentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

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

export interface AdminPaymentResult {
  payment: any;
  bill: any;
  table: any;
  changeAmount: number | null;
  isFullyPaid: boolean;
  isIdempotent: boolean;
}

/**
 * Merkezi admin ödeme fonksiyonu.
 *
 * Kurallar:
 * - Yalnızca admin/super_admin route seviyesinde çağırmalı
 * - Nakit: receivedAmount zorunlu ve >= amount
 * - Kart/online: receivedAmount null
 * - Kalan borcu Decimal aritmetikle hesaplar
 * - Idempotency key kontrolü yapar
 * - Kısmi ödeme: bill ve masa açık kalır
 * - Tam ödeme: bill, tableSession, masa, customerSessions hepsini kapatır
 */
export async function processAdminPayment(input: AdminPaymentInput): Promise<AdminPaymentResult> {
  const { billId, amount, method, receivedAmount, note, idempotencyKey, adminId, adminName, businessId } = input;

  // ── Temel doğrulama ───────────────────────────────────────────────────
  if (typeof amount !== "number" || amount <= 0) {
    throw new PaymentError("INVALID_AMOUNT", "Ödeme tutarı sıfırdan büyük olmalıdır.");
  }

  // ── Nakit doğrulama ───────────────────────────────────────────────────
  if (method === "CASH") {
    if (receivedAmount == null || typeof receivedAmount !== "number" || receivedAmount <= 0) {
      throw new PaymentError("CASH_RECEIVED_AMOUNT_REQUIRED", "Nakit ödeme için müşteriden alınan tutar belirtilmelidir.");
    }
    if (receivedAmount < amount) {
      throw new PaymentError(
        "INSUFFICIENT_CASH_RECEIVED",
        `Alınan tutar (₺${receivedAmount.toFixed(2)}), ödenmesi gereken tutardan (₺${amount.toFixed(2)}) küçük olamaz.`
      );
    }
  }

  // ── Transaction ───────────────────────────────────────────────────────
  return prisma.$transaction(async (tx) => {
    // 1. Idempotency kontrolü
    if (idempotencyKey) {
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
        include: {
          bill: true,
          table: true,
        },
      });

      if (existingPayment) {
        // Aynı işlemi temsil ediyor mu?
        if (
          existingPayment.businessId !== businessId ||
          existingPayment.billId !== billId ||
          Number(existingPayment.amount) !== amount ||
          existingPayment.method !== method
        ) {
          throw new PaymentError(
            "IDEMPOTENCY_KEY_CONFLICT",
            "Bu idempotency anahtarı farklı bir ödeme işlemi için kullanılmış.",
            409
          );
        }
        // Aynı işlem — idempotent dönüş
        return {
          payment: existingPayment,
          bill: existingPayment.bill,
          table: existingPayment.table,
          changeAmount: existingPayment.changeAmount ? Number(existingPayment.changeAmount) : null,
          isFullyPaid: existingPayment.bill?.paymentStatus === "PAID",
          isIdempotent: true,
        };
      }
    }

    // 2. Bill doğrulama
    const bill = await tx.bill.findFirst({
      where: { id: billId, businessId },
      include: { table: true, tableSession: true },
    });

    if (!bill) {
      throw new PaymentError("BILL_NOT_FOUND", "Adisyon bulunamadı.", 404);
    }

    if (bill.status !== "OPEN") {
      throw new PaymentError("BILL_ALREADY_CLOSED", "Bu adisyon zaten kapatılmış.");
    }

    if (!bill.tableSession || bill.tableSession.status !== "ACTIVE") {
      throw new PaymentError("SESSION_NOT_ACTIVE", "Bu masanın aktif oturumu bulunamadı.");
    }

    // 3. Gerçek sipariş toplamını sunucuda hesapla (Decimal)
    const orders = await tx.order.findMany({
      where: {
        tableSessionId: bill.tableSessionId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });

    const serverTotalDecimal = orders.reduce(
      (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
      new Decimal(0)
    );

    // 4. Daha önce yapılan toplam ödemeyi hesapla (yalnız PAID)
    const existingPayments = await tx.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });

    const alreadyPaidDecimal = existingPayments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount.toString())),
      new Decimal(0)
    );

    // 5. Kalan borç (Decimal)
    const remainingDueDecimal = Decimal.max(new Decimal(0), serverTotalDecimal.sub(alreadyPaidDecimal));
    const remainingDue = remainingDueDecimal.toNumber();

    // 6. Tutar doğrulama
    const amountDecimal = new Decimal(amount.toFixed(2));

    if (amountDecimal.greaterThan(remainingDueDecimal)) {
      throw new PaymentError(
        "AMOUNT_EXCEEDS_REMAINING_DUE",
        `Ödeme tutarı (₺${amount.toFixed(2)}) kalan borçtan (₺${remainingDue.toFixed(2)}) büyük olamaz.`
      );
    }

    // 7. Nakit: changeAmount hesapla (Decimal)
    let changeAmountDecimal: Decimal | null = null;
    let receivedAmountDecimal: Decimal | null = null;
    if (method === "CASH" && receivedAmount != null) {
      receivedAmountDecimal = new Decimal(receivedAmount.toFixed(2));
      changeAmountDecimal = receivedAmountDecimal.sub(amountDecimal);
    }

    // 8. Ödeme kaydı oluştur
    const payment = await tx.payment.create({
      data: {
        businessId,
        tableId: bill.tableId,
        tableSessionId: bill.tableSessionId,
        billId: bill.id,
        amount: amountDecimal,
        receivedAmount: receivedAmountDecimal,
        changeAmount: changeAmountDecimal,
        method: method as PaymentMethod,
        note: note || null,
        idempotencyKey: idempotencyKey || null,
        status: "PAID",
        paidAt: new Date(),
        handledById: adminId,
        handledByWaiterName: adminName,
      },
    });

    // 9. Tüm ödemeleri topla (yeni dahil)
    const allPayments = await tx.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });

    const totalPaidDecimal = allPayments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount.toString())),
      new Decimal(0)
    );

    const newRemainingDecimal = Decimal.max(new Decimal(0), serverTotalDecimal.sub(totalPaidDecimal));
    const isFullyPaid = newRemainingDecimal.isZero() && serverTotalDecimal.greaterThan(new Decimal(0));

    let billPaymentStatus: BillPaymentStatus = "UNPAID";
    if (isFullyPaid) billPaymentStatus = "PAID";
    else if (totalPaidDecimal.greaterThan(new Decimal(0))) billPaymentStatus = "PARTIALLY_PAID";

    const now = new Date();

    // 10. Bill güncelle
    const updatedBill = await tx.bill.update({
      where: { id: bill.id },
      data: {
        totalAmount: serverTotalDecimal,
        paidAmount: totalPaidDecimal,
        remainingAmount: newRemainingDecimal,
        paymentStatus: billPaymentStatus,
        ...(isFullyPaid ? { status: "CLOSED" as BillStatus, closedAt: now } : {}),
      },
    });

    // 11. Tam ödeme — atomik kapanış
    if (isFullyPaid) {
      // Siparişleri ödendi yap
      await tx.order.updateMany({
        where: {
          tableSessionId: bill.tableSessionId,
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
        data: { paymentStatus: "PAID" },
      });

      // Masa oturumunu kapat
      await tx.tableSession.update({
        where: { id: bill.tableSessionId },
        data: {
          status: "CLOSED",
          endedAt: now,
          closedById: adminId,
          closeReason: "PAYMENT_COMPLETED",
        },
      });

      // Masa EMPTY
      await tx.table.update({
        where: { id: bill.tableId },
        data: { status: "EMPTY" },
      });

      // CustomerSession kayıtlarını kapat
      await tx.customerSession.updateMany({
        where: {
          tableId: bill.tableId,
          businessId,
          status: "ACTIVE",
        },
        data: {
          status: "CLOSED",
          authorizationStatus: "REVOKED",
          closedAt: now,
        },
      });

      // Açık hizmet taleplerini kapat
      await tx.serviceRequest.updateMany({
        where: {
          tableId: bill.tableId,
          businessId,
          status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
        },
        data: { status: "CANCELLED", resolvedAt: now },
      });

      // Bekleyen ödeme taleplerini iptal et
      await tx.payment.updateMany({
        where: {
          tableSessionId: bill.tableSessionId,
          status: "PENDING",
          id: { not: payment.id },
        },
        data: { status: "CANCELLED" },
      });

      // Okunmamış bildirimleri okundu yap
      await tx.notification.updateMany({
        where: {
          tableId: bill.tableId,
          businessId,
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    // Güncel table bilgisini al
    const updatedTable = await tx.table.findUnique({ where: { id: bill.tableId } });

    return {
      payment,
      bill: updatedBill,
      table: updatedTable || bill.table,
      changeAmount: changeAmountDecimal ? changeAmountDecimal.toNumber() : null,
      isFullyPaid,
      isIdempotent: false,
    };
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
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    return { success: true };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 8a. YARDIMCI: MASA DURUMUNU TRANSACTION İÇİNDEN YENİDEN HESAPLA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Masanın gerçek durumunu veritabanındaki kayıtlardan yeniden hesaplar.
 * Dış transaction içinden çağrılabilir (TxClient alır).
 *
 * Karar kuralı:
 *   Aktif TableSession yok + açık Bill yok + gerçek aktif sipariş yok → EMPTY
 *   Aktif TableSession varsa:
 *     PREPARING sipariş varsa          → PREPARING
 *     PENDING veya ACCEPTED varsa      → HAS_ORDER
 *     Aktif PAYMENT_REQUEST varsa      → PAYMENT_REQUESTED
 *     Servis edilmiş açık hesap varsa  → SERVED
 *     Hiçbiri yoksa                    → OCCUPIED
 *
 * Masayı transaction içinde günceller ve hesaplanan durumu döndürür.
 */
export async function recalculateTableStatus(
  tx: TxClient,
  opts: { businessId: string; tableId: string }
): Promise<TableStatus> {
  const { businessId, tableId } = opts;

  // 1. Aktif TableSession var mı?
  const activeSession = await tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: { bill: true },
  });

  // 2. Açık Bill var mı? (session bağımsız kontrol — güvenlik)
  const openBill = await tx.bill.findFirst({
    where: { tableId, businessId, status: "OPEN" },
  });

  // 3. Gerçek aktif / ödenmemiş sipariş var mı?
  const activeOrderCount = await tx.order.count({
    where: {
      tableId,
      status: { in: ["PENDING", "ACCEPTED", "PREPARING", "SERVED"] },
    },
  });

  // ── Aktif session yoksa ──────────────────────────────────────────────
  if (!activeSession && !openBill && activeOrderCount === 0) {
    const table = await tx.table.findUnique({ where: { id: tableId } });
    if (table && table.status !== TableStatus.EMPTY) {
      await tx.table.update({
        where: { id: tableId },
        data: { status: TableStatus.EMPTY },
      });
    }
    return TableStatus.EMPTY;
  }

  // ── Aktif session varsa — durumu gerçek verilerden hesapla ──────────
  if (activeSession) {
    // Sipariş durumlarını grupla
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

    let computed: TableStatus;

    if (statusMap["PREPARING"]) {
      computed = TableStatus.PREPARING;
    } else if (statusMap["PENDING"] || statusMap["ACCEPTED"]) {
      computed = TableStatus.HAS_ORDER;
    } else {
      // Aktif PAYMENT_REQUEST var mı?
      const activePR = await tx.serviceRequest.count({
        where: {
          tableId,
          requestType: "PAYMENT_REQUEST",
          status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
        },
      });
      // Bekleyen ödeme var mı?
      const pendingPayment = await tx.payment.count({
        where: { tableSessionId: activeSession.id, status: "PENDING" },
      });

      if (activePR > 0 || pendingPayment > 0) {
        computed = TableStatus.PAYMENT_REQUESTED;
      } else if (
        statusMap["SERVED"] &&
        activeSession.bill &&
        activeSession.bill.status === "OPEN"
      ) {
        computed = TableStatus.SERVED;
      } else {
        computed = TableStatus.OCCUPIED;
      }
    }

    // Güncelle (gereksiz yazma yok)
    const table = await tx.table.findUnique({ where: { id: tableId } });
    if (table && table.status !== computed) {
      await tx.table.update({
        where: { id: tableId },
        data: { status: computed },
      });
    }

    return computed;
  }

  // Aktif session yok ama açık bill veya aktif sipariş var — tutarsız durum
  // Güvenli tarafta kal: OCCUPIED
  const table = await tx.table.findUnique({ where: { id: tableId } });
  if (table && table.status !== TableStatus.OCCUPIED) {
    await tx.table.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });
  }
  return TableStatus.OCCUPIED;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8b. YARDIMCI: MASA DURUMUNU SENKRONIZE ET (eski — kendi transaction'ı var)
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
