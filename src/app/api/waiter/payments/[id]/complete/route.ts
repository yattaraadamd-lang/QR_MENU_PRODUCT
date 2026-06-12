import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiter, getBusinessId } from "@/lib/auth-helpers";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { closeTable } from "@/lib/services/table-flow.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error("Ödeme tamamlama hatası:", error);

    if (error.message === "Ödeme bulunamadı") {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
