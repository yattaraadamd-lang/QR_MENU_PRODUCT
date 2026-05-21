import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const billId = params.id;
    const body = await request.json();
    const { amount, paymentMethod } = body; // paymentMethod: CASH, CREDIT_CARD, ONLINE

    if (!amount || amount <= 0 || !paymentMethod) {
      return NextResponse.json({ error: "Geçersiz ödeme bilgileri" }, { status: 400 });
    }

    // Faturayı getir
    const bill = await prisma.bill.findUnique({
      where: { id: billId, businessId: session.user.businessId },
      include: { table: true, tableSession: true }
    });

    if (!bill) {
      return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });
    }

    if (bill.status !== "OPEN") {
      return NextResponse.json({ error: "Bu adisyon zaten kapatılmış" }, { status: 400 });
    }

    const paymentAmount = Number(amount);
    const newPaidAmount = Number(bill.paidAmount) + paymentAmount;
    const newRemainingAmount = Math.max(0, Number(bill.totalAmount) - newPaidAmount);

    let paymentStatus: any = "PARTIALLY_PAID";
    let billStatus: any = "OPEN";

    // Tamamı ödendiyse
    if (newRemainingAmount === 0) {
      paymentStatus = "PAID";
      billStatus = "CLOSED";
    }

    // İşlem (Transaction) - Ödemeyi kaydet ve faturayı güncelle
    const updatedBill = await prisma.$transaction(async (tx) => {
      // Ödeme kaydı
        await tx.payment.create({
          data: {
            businessId: session.user.businessId,
            tableId: bill.tableId,
            tableSessionId: bill.tableSessionId,
            billId: bill.id,
            amount: paymentAmount,
            method: paymentMethod === "CREDIT_CARD" ? "CARD" : paymentMethod,
            status: "PAID"
          }
        });

      // Siparişleri güncelle (Eğer fatura kapanıyorsa siparişleri de ödendi işaretle)
      if (billStatus === "CLOSED") {
        await tx.order.updateMany({
          where: { tableSessionId: bill.tableSessionId },
          data: { paymentStatus: "PAID" }
        });

        // Masa oturumunu kapat
        await tx.tableSession.update({
          where: { id: bill.tableSessionId },
          data: { status: "CLOSED", endedAt: new Date() }
        });

        // Masayı temizlik durumuna al
        await tx.table.update({
          where: { id: bill.tableId },
          data: { status: TableStatus.CLEANING_NEEDED }
        });
      }

      // Faturayı güncelle
      return await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          paymentStatus: paymentStatus,
          status: billStatus
        }
      });
    });

    // Soket bildirimi - Eğer masa temizlik durumuna geçtiyse garsonlara bildir
    if (billStatus === "CLOSED" && bill.table) {
      try {
        emitToBusinessRoom(session.user.businessId, "table_status_update", {
          tableId: bill.table.id,
          status: "CLEANING_NEEDED",
          message: `${bill.table.tableName || "Masa " + bill.table.tableNumber} hesabı ödendi, temizlik gerekiyor.`
        });
      } catch (e) {
        console.error("Soket emit hatası:", e);
      }
    }

    return NextResponse.json({ success: true, bill: updatedBill });
  } catch (error) {
    console.error("Ödeme alma hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
