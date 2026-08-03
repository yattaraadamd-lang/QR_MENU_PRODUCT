import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiter, getBusinessId } from "@/lib/auth-helpers";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { closeTable } from "@/lib/services/table-flow.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let paymentId: string | undefined;
  
  try {
    const params = await context.params;
    paymentId = params.id;
    
    const { error, response, session } = await requireWaiter();

    if (error || !session || !session.user?.id) {
      return (
        response ||
        NextResponse.json(
          { success: false, error: "Yetkisiz erişim" },
          { status: 401 }
        )
      );
    }

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { method, note, receivedAmount } = body;

    // ✅ Transaction ile ödeme tamamla + masa durumu güncelle
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: params.id, businessId },
        include: { tableSession: true },
      });

      if (!payment) {
        throw new Error("Ödeme bulunamadı");
      }

      const dueAmount = Number(payment.amount);

      // ✅ Nakit ödeme için validasyon
      if (method === "CASH") {
        if (!receivedAmount || typeof receivedAmount !== "number" || receivedAmount <= 0) {
          throw new Error("Nakit ödeme için alınan tutar belirtilmelidir");
        }
        
        if (receivedAmount < dueAmount) {
          throw new Error(
            `Alınan tutar (₺${receivedAmount.toFixed(2)}), ödenmesi gereken tutardan (₺${dueAmount.toFixed(2)}) küçük olamaz`
          );
        }
      }

      // Ödemeyi tamamla
      // ✅ Ciroya eklenecek tutar her zaman dueAmount (payment.amount)
      // receivedAmount sadece para üstü hesabı için kullanılır
      const changeAmount = method === "CASH" && receivedAmount ? receivedAmount - dueAmount : 0;
      
      const updatedPayment = await tx.payment.update({
        where: { id: params.id },
        data: {
          status: PaymentStatus.PAID,
          method: method as PaymentMethod,
          note: note || null,
          paidAt: new Date(),
          handledById: session.user.id,
          handledByWaiterName: session.user.name || null,
          receivedAmount: method === "CASH" && receivedAmount ? receivedAmount : null,
          changeAmount: method === "CASH" && receivedAmount ? changeAmount : null,
        },
      });

      // ✅ Bill güncelle (varsa)
      if (payment.billId) {
        // Tüm ödemeleri yeniden hesapla
        const allPayments = await tx.payment.findMany({
          where: { billId: payment.billId, status: "PAID" },
        });
        const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0);

        const bill = await tx.bill.findUnique({ where: { id: payment.billId } });
        if (bill) {
          const remainingAmount = Math.max(0, Number(bill.totalAmount) - paidAmount);
          let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
          if (remainingAmount === 0 && Number(bill.totalAmount) > 0) paymentStatus = "PAID";
          else if (paidAmount > 0) paymentStatus = "PARTIALLY_PAID";

          await tx.bill.update({
            where: { id: payment.billId },
            data: { paidAmount, remainingAmount, paymentStatus },
          });
        }
      }

      // ✅ Masa durumunu SERVED yap (EMPTY yapmıyoruz — garson ayrıca "Masayı Kapat" basmalı)
      await tx.table.update({
        where: { id: payment.tableId },
        data: { status: "SERVED" },
      });

      return updatedPayment;
    }, { maxWait: 10_000, timeout: 20_000 });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error("[PAYMENT_COMPLETE_FAILED]", {
      endpoint: "/api/waiter/payments/[id]/complete",
      code: error?.code,
      name: error?.name,
      message: error?.message,
      meta: error?.meta,
      paymentId: paymentId,
    });

    // Ödeme bulunamadı
    if (error.message === "Ödeme bulunamadı") {
      return NextResponse.json(
        { success: false, error: error.message, code: "PAYMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Nakit tutar doğrulama hataları
    if (error.message?.includes("alınan tutar belirtilmelidir")) {
      return NextResponse.json(
        { success: false, error: error.message, code: "CASH_RECEIVED_AMOUNT_REQUIRED" },
        { status: 400 }
      );
    }

    if (error.message?.includes("küçük olamaz") || error.message?.includes("yetersiz")) {
      return NextResponse.json(
        { success: false, error: error.message, code: "CASH_AMOUNT_INSUFFICIENT" },
        { status: 400 }
      );
    }

    // İş kuralı hataları
    if (error.message?.includes("Kalan borç") || error.message?.includes("0 veya negatif")) {
      return NextResponse.json(
        { success: false, error: error.message, code: "INVALID_PAYMENT_AMOUNT" },
        { status: 400 }
      );
    }

    // Prisma şema hataları
    if (error?.code === "P2021" || error?.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          error: "Veritabanı güncellemesi tamamlanmamış. Lütfen yöneticiye bildirin.",
          code: "DATABASE_SCHEMA_OUTDATED",
        },
        { status: 503 }
      );
    }

    // Prisma duplicate/constraint hataları
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Bu ödeme zaten işlenmiş.", code: "DUPLICATE_PAYMENT" },
        { status: 409 }
      );
    }

    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Ödeme durumu değişti. Lütfen sayfayı yenileyin.", code: "PAYMENT_STATE_CHANGED" },
        { status: 409 }
      );
    }

    // Prisma transaction timeout
    if (error?.code === "P2028" || error?.message?.includes("Transaction not found")) {
      return NextResponse.json(
        { success: false, error: "İşlem zaman aşımına uğradı. Tekrar deneyin.", code: "PAYMENT_TRANSACTION_EXPIRED" },
        { status: 503 }
      );
    }

    // Genel sunucu hatası
    return NextResponse.json(
      { success: false, error: "Ödeme işlenirken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
