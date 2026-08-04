import { prisma } from "@/lib/prisma";
import { PaymentStatus, PaymentMethod, BillStatus, BillPaymentStatus, TableStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export type ProcessAdminPaymentInput = {
  paymentId: string;
  businessId: string;
  adminId: string;
  adminName: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
};

export type ProcessAdminPaymentResult = {
  payment: any;
  bill: any;
  table: any;
  changeAmount: number | null;
  isFullyPaid: boolean;
  isIdempotent: boolean;
};

/**
 * Garsonun ödemeyi admin onayına göndermesi
 */
export async function requestWaiterApproval(input: {
  paymentId: string;
  businessId: string;
  waiterId: string;
  waiterName: string;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  amount: number;
  receivedAmount?: number | null;
  note?: string | null;
}) {
  const { paymentId, businessId, waiterId, waiterName, method, amount, receivedAmount, note } = input;

  if (typeof amount !== "number" || amount <= 0) {
    throw new PaymentError("Geçersiz ödeme tutarı.", "INVALID_PAYMENT_AMOUNT", 400);
  }

  if (method === "CASH") {
    if (receivedAmount == null || typeof receivedAmount !== "number" || receivedAmount <= 0) {
      throw new PaymentError("Nakit ödeme için alınan tutar belirtilmelidir.", "CASH_RECEIVED_AMOUNT_REQUIRED", 400);
    }
    if (receivedAmount < amount) {
      throw new PaymentError(
        `Alınan tutar (₺${receivedAmount.toFixed(2)}), ödenmesi gereken tutardan (₺${amount.toFixed(2)}) küçük olamaz.`,
        "CASH_AMOUNT_INSUFFICIENT",
        400
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, businessId },
        include: { bill: true, tableSession: true, table: true },
      });

      if (!payment) {
        throw new PaymentError("Ödeme bulunamadı.", "PAYMENT_NOT_FOUND", 404);
      }

      if (payment.status !== "PENDING" && payment.status !== "REJECTED") {
        throw new PaymentError("Bu ödeme talebi şu an onaylama için uygun değil.", "PAYMENT_STATE_CHANGED", 409);
      }

      if (!payment.billId) {
        throw new PaymentError("Ödeme kaydına bağlı adisyon bulunamadı.", "BILL_NOT_FOUND", 404);
      }

      const bill = await tx.bill.findUnique({ where: { id: payment.billId } });
      if (!bill || bill.status !== "OPEN") {
        throw new PaymentError("Adisyon kapalı veya bulunamadı.", "BILL_ALREADY_CLOSED", 409);
      }

      // Sipariş toplamı ve paid borç kontrolü
      const orders = await tx.order.findMany({
        where: {
          tableSessionId: payment.tableSessionId || undefined,
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });

      const serverTotalDecimal = orders.reduce(
        (sum, o) => sum.add(new Decimal(o.totalPrice.toString())),
        new Decimal(0)
      );

      const existingPaidPayments = await tx.payment.findMany({
        where: { billId: bill.id, status: "PAID" },
      });

      const paidTotalDecimal = existingPaidPayments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount.toString())),
        new Decimal(0)
      );

      const remainingDueDecimal = Decimal.max(new Decimal(0), serverTotalDecimal.sub(paidTotalDecimal));
      const amountDecimal = new Decimal(amount.toFixed(2));

      if (amountDecimal.greaterThan(remainingDueDecimal)) {
        throw new PaymentError(
          `Talep edilen tutar (₺${amount.toFixed(2)}) kalan borçtan (₺${remainingDueDecimal.toFixed(2)}) büyük olamaz.`,
          "AMOUNT_EXCEEDS_REMAINING",
          400
        );
      }

      let changeAmountDecimal: Decimal | null = null;
      let receivedAmountDecimal: Decimal | null = null;

      if (method === "CASH" && receivedAmount != null) {
        receivedAmountDecimal = new Decimal(receivedAmount.toFixed(2));
        changeAmountDecimal = receivedAmountDecimal.sub(amountDecimal);
      }

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "AWAITING_ADMIN_APPROVAL",
          method: method as PaymentMethod,
          amount: amountDecimal,
          receivedAmount: receivedAmountDecimal,
          changeAmount: changeAmountDecimal,
          note: note || null,
          requestedById: waiterId,
          requestedByName: waiterName,
          approvalRequestedAt: new Date(),
          handledById: waiterId,
          handledByWaiterName: waiterName,
        },
        include: {
          table: { select: { id: true, tableNumber: true, tableName: true } },
          bill: true,
        },
      });

      return updatedPayment;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}

/**
 * Admin tarafından ödemenin onaylanması ve finansal işlemlerin yapılması
 */
export async function processAdminPayment(input: ProcessAdminPaymentInput): Promise<ProcessAdminPaymentResult> {
  const { paymentId, businessId, adminId, adminName, amount, method, receivedAmount, note, idempotencyKey } = input;

  if (typeof amount !== "number" || amount <= 0) {
    throw new PaymentError("Ödeme tutarı sıfırdan büyük olmalıdır.", "INVALID_PAYMENT_AMOUNT", 400);
  }

  if (method === "CASH") {
    if (receivedAmount == null || typeof receivedAmount !== "number" || receivedAmount <= 0) {
      throw new PaymentError("Nakit ödeme için müşteriden alınan tutar belirtilmelidir.", "CASH_RECEIVED_AMOUNT_REQUIRED", 400);
    }
    if (receivedAmount < amount) {
      throw new PaymentError(
        `Alınan tutar (₺${receivedAmount.toFixed(2)}), ödenmesi gereken tutardan (₺${amount.toFixed(2)}) küçük olamaz.`,
        "CASH_AMOUNT_INSUFFICIENT",
        400
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // 1. Idempotency kontrolü
      if (idempotencyKey) {
        const existingIdempotent = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: { bill: true, table: true },
        });

        if (existingIdempotent) {
          if (existingIdempotent.businessId !== businessId) {
            throw new PaymentError("İdempotency anahtarı uyumsuz.", "DUPLICATE_PAYMENT", 409);
          }
          return {
            payment: existingIdempotent,
            bill: existingIdempotent.bill,
            table: existingIdempotent.table,
            changeAmount: existingIdempotent.changeAmount ? Number(existingIdempotent.changeAmount) : null,
            isFullyPaid: existingIdempotent.bill?.paymentStatus === "PAID",
            isIdempotent: true,
          };
        }
      }

      // 2. Lock & State check
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, businessId },
      });

      if (!payment) {
        throw new PaymentError("Ödeme bulunamadı.", "PAYMENT_NOT_FOUND", 404);
      }

      if (payment.status === "PAID") {
        const bill = await tx.bill.findUnique({ where: { id: payment.billId! } });
        const table = await tx.table.findUnique({ where: { id: payment.tableId } });
        return {
          payment,
          bill,
          table,
          changeAmount: payment.changeAmount ? Number(payment.changeAmount) : null,
          isFullyPaid: bill?.paymentStatus === "PAID",
          isIdempotent: true,
        };
      }

      if (payment.status !== "AWAITING_ADMIN_APPROVAL" && payment.status !== "PENDING") {
        throw new PaymentError("Ödeme durumu onay için uygun değil.", "PAYMENT_STATE_CHANGED", 409);
      }

      // Atomic lock using updateMany
      const lockResult = await tx.payment.updateMany({
        where: {
          id: paymentId,
          businessId,
          status: { in: ["AWAITING_ADMIN_APPROVAL", "PENDING"] },
        },
        data: { status: "PROCESSING" },
      });

      if (lockResult.count !== 1) {
        throw new PaymentError("Ödeme durumu eşzamanlı olarak değişti.", "PAYMENT_STATE_CHANGED", 409);
      }

      // 3. Bill & TableSession validation
      if (!payment.billId) {
        throw new PaymentError("Adisyon bulunamadı.", "BILL_NOT_FOUND", 404);
      }

      const bill = await tx.bill.findFirst({
        where: { id: payment.billId, businessId },
        include: { tableSession: true, table: true },
      });

      if (!bill) {
        throw new PaymentError("Adisyon bulunamadı.", "BILL_NOT_FOUND", 404);
      }

      if (bill.status !== "OPEN") {
        throw new PaymentError("Bu adisyon zaten kapatılmış.", "BILL_ALREADY_CLOSED", 409);
      }

      if (!bill.tableSession || bill.tableSession.status !== "ACTIVE") {
        throw new PaymentError("Aktif masa oturumu bulunamadı.", "TABLE_SESSION_NOT_ACTIVE", 409);
      }

      // 4. Server-side total calculation (Decimal)
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

      // 5. Existing PAID payments calculation
      const existingPaidPayments = await tx.payment.findMany({
        where: { billId: bill.id, status: "PAID" },
      });

      const alreadyPaidDecimal = existingPaidPayments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount.toString())),
        new Decimal(0)
      );

      // 6. Remaining due
      const remainingDueDecimal = Decimal.max(new Decimal(0), serverTotalDecimal.sub(alreadyPaidDecimal));

      if (remainingDueDecimal.isZero()) {
        throw new PaymentError("Adisyonun kalan borcu bulunmamaktadır.", "BILL_ALREADY_PAID", 409);
      }

      const amountDecimal = new Decimal(amount.toFixed(2));
      if (amountDecimal.greaterThan(remainingDueDecimal)) {
        throw new PaymentError(
          `Ödeme tutarı (₺${amount.toFixed(2)}) kalan borçtan (₺${remainingDueDecimal.toNumber().toFixed(2)}) büyük olamaz.`,
          "AMOUNT_EXCEEDS_REMAINING",
          400
        );
      }

      let changeAmountDecimal: Decimal | null = null;
      let receivedAmountDecimal: Decimal | null = null;
      if (method === "CASH" && receivedAmount != null) {
        receivedAmountDecimal = new Decimal(receivedAmount.toFixed(2));
        changeAmountDecimal = receivedAmountDecimal.sub(amountDecimal);
      }

      const now = new Date();

      // 7. Update Payment -> PAID
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: amountDecimal,
          receivedAmount: receivedAmountDecimal,
          changeAmount: changeAmountDecimal,
          status: "PAID",
          method: method as PaymentMethod,
          note: note || payment.note || null,
          idempotencyKey: idempotencyKey || null,
          paidAt: now,
          approvedById: adminId,
          approvedByName: adminName,
          approvedAt: now,
        },
      });

      // 8. Calculate total paid with this payment
      const totalPaidDecimal = alreadyPaidDecimal.add(amountDecimal);
      const newRemainingDecimal = Decimal.max(new Decimal(0), serverTotalDecimal.sub(totalPaidDecimal));
      const isFullyPaid = newRemainingDecimal.isZero() && serverTotalDecimal.greaterThan(new Decimal(0));

      let billPaymentStatus: BillPaymentStatus = "UNPAID";
      if (isFullyPaid) billPaymentStatus = "PAID";
      else if (totalPaidDecimal.greaterThan(new Decimal(0))) billPaymentStatus = "PARTIALLY_PAID";

      // 9. Update Bill
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

      // 10. Atomic Full Payment Closures
      if (isFullyPaid) {
        await tx.order.updateMany({
          where: {
            tableSessionId: bill.tableSessionId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
          },
          data: { paymentStatus: "PAID" },
        });

        await tx.tableSession.update({
          where: { id: bill.tableSessionId },
          data: {
            status: "CLOSED",
            endedAt: now,
            closedById: adminId,
            closeReason: "PAYMENT_COMPLETED",
          },
        });

        await tx.table.update({
          where: { id: bill.tableId },
          data: { status: "EMPTY" },
        });

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

        await tx.serviceRequest.updateMany({
          where: {
            tableId: bill.tableId,
            businessId,
            status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
          },
          data: { status: "COMPLETED", completedAt: now, resolvedAt: now },
        });

        await tx.payment.updateMany({
          where: {
            tableSessionId: bill.tableSessionId,
            status: { in: ["PENDING", "AWAITING_ADMIN_APPROVAL", "PROCESSING"] },
            id: { not: updatedPayment.id },
          },
          data: { status: "CANCELLED" },
        });

        await tx.notification.updateMany({
          where: {
            tableId: bill.tableId,
            businessId,
            isRead: false,
          },
          data: { isRead: true },
        });
      }

      const updatedTable = await tx.table.findUnique({ where: { id: bill.tableId } });

      return {
        payment: updatedPayment,
        bill: updatedBill,
        table: updatedTable || bill.table,
        changeAmount: changeAmountDecimal ? changeAmountDecimal.toNumber() : null,
        isFullyPaid,
        isIdempotent: false,
      };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}

/**
 * Admin'in doğrudan talep olmadan ödeme oluşturup onaylaması (Açık adisyondan)
 */
export async function createDirectAdminPayment(input: {
  billId: string;
  businessId: string;
  adminId: string;
  adminName: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
}): Promise<ProcessAdminPaymentResult> {
  const { billId, businessId, adminId, adminName, amount, method, receivedAmount, note, idempotencyKey } = input;

  const bill = await prisma.bill.findFirst({
    where: { id: billId, businessId, status: "OPEN" },
    include: { tableSession: true },
  });

  if (!bill || !bill.tableSession) {
    throw new PaymentError("Açık adisyon veya aktif masa oturumu bulunamadı.", "BILL_NOT_FOUND", 404);
  }

  // Yeni PENDING payment oluştur
  const payment = await prisma.payment.create({
    data: {
      businessId,
      tableId: bill.tableId,
      tableSessionId: bill.tableSessionId,
      billId: bill.id,
      amount: new Decimal(amount.toFixed(2)),
      method: method as PaymentMethod,
      note: note || null,
      status: "AWAITING_ADMIN_APPROVAL",
      requestedById: adminId,
      requestedByName: adminName,
      approvalRequestedAt: new Date(),
    },
  });

  // processAdminPayment çağır
  return processAdminPayment({
    paymentId: payment.id,
    businessId,
    adminId,
    adminName,
    amount,
    method,
    receivedAmount,
    note,
    idempotencyKey,
  });
}

/**
 * Admin tarafında ödemenin reddedilmesi
 */
export async function rejectPayment(input: {
  paymentId: string;
  businessId: string;
  adminId: string;
  reason?: string | null;
}) {
  const { paymentId, businessId, adminId, reason } = input;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, businessId },
    });

    if (!payment) {
      throw new PaymentError("Ödeme bulunamadı.", "PAYMENT_NOT_FOUND", 404);
    }

    if (payment.status === "PAID" || payment.status === "REJECTED" || payment.status === "CANCELLED") {
      throw new PaymentError("Bu ödeme işlemi reddedilemez durumda.", "PAYMENT_STATE_CHANGED", 409);
    }

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        rejectedById: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason || "Admin tarafından reddedildi.",
      },
    });

    return updatedPayment;
  });
}
