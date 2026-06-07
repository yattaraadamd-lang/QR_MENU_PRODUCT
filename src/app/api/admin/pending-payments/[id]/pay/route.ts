import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    // ✅ ÇIFT CİRO ÖNLEMİ: Aynı Bill için zaten PAID Payment var mı?
    const existingPaidPayment = await prisma.payment.findFirst({
      where: {
        billId: bill.id,
        status: "PAID",
      },
    });

    if (existingPaidPayment) {
      return NextResponse.json(
        {
          error: "Bu adisyon için zaten ödeme alınmış. Çift ödeme kabul edilemez.",
          existingPayment: {
            id: existingPaidPayment.id,
            amount: existingPaidPayment.amount,
            paidAt: existingPaidPayment.paidAt,
            method: existingPaidPayment.method,
          },
        },
        { status: 409 } // Conflict
      );
    }

    // ✅ Bill'in güncel durumunu server-side hesapla
    const orders = await prisma.order.findMany({
      where: {
        tableSessionId: bill.tableSessionId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    const serverTotalAmount = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    // Ödeme tutarı kontrolü
    const paymentAmount = Number(amount);
    if (paymentAmount > serverTotalAmount) {
      return NextResponse.json(
        { error: `Ödeme tutarı toplam hesaptan fazla olamaz (Max: ₺${serverTotalAmount.toFixed(2)})` },
        { status: 400 }
      );
    }

    const paymentAmount = Number(amount);
    const newPaidAmount = Number(bill.paidAmount) + paymentAmount;
    const newRemainingAmount = Math.max(0, serverTotalAmount - newPaidAmount);

    let paymentStatus: "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
    let billStatus: "OPEN" | "CLOSED" = "OPEN";
    const now = new Date();

    // Tamamı ödendiyse
    if (newRemainingAmount === 0) {
      paymentStatus = "PAID";
      billStatus = "CLOSED";
    }

    // İşlem (Transaction) - Ödemeyi kaydet ve faturayı güncelle
    const updatedBill = await prisma.$transaction(async (tx) => {
      // ✅ ÇIFT CİRO ÖNLEMİ: Transaction içinde tekrar kontrol
      const doubleCheck = await tx.payment.findFirst({
        where: { billId: bill.id, status: "PAID" },
      });
      if (doubleCheck) {
        throw new Error("Bu adisyon için zaten ödeme alınmış");
      }

      // ✅ Ödeme kaydı oluştur
      await tx.payment.create({
        data: {
          businessId: session.user.businessId,
          tableId: bill.tableId,
          tableSessionId: bill.tableSessionId,
          billId: bill.id,
          amount: paymentAmount,
          method: paymentMethod === "CREDIT_CARD" ? "CARD" : paymentMethod,
          status: "PAID",
          paidAt: now,
          handledById: session.user.id,
          handledByWaiterName: session.user.name || "Admin",
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
          data: { status: "CLOSED", endedAt: now }
        });

        // ✅ HATA DÜZELTİLDİ: CLEANING_NEEDED yerine EMPTY — ödeme sonrası masa boş görünmeli
        await tx.table.update({
          where: { id: bill.tableId },
          data: { status: "EMPTY" }
        });

        // ✅ Aktif CustomerSession'ları kapat — eski QR ile sipariş verilmesin
        await tx.customerSession.updateMany({
          where: {
            tableId: bill.tableId,
            businessId: session.user.businessId,
            status: "ACTIVE",
          },
          data: { status: "CLOSED" },
        });
      }

      // Faturayı güncelle — server-side hesaplanan totalAmount kullan
      return await tx.bill.update({
        where: { id: bill.id },
        data: {
          totalAmount: serverTotalAmount, // ✅ Server-side hesaplanan değer
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          paymentStatus: paymentStatus,
          status: billStatus,
          ...(billStatus === "CLOSED" ? { closedAt: now } : {}),
        }
      });
    });

    // Soket bildirimi — masa boş oldu, panelleri güncelle
    if (billStatus === "CLOSED" && bill.table) {
      try {
        emitToBusinessRoom(session.user.businessId, "table_status_update", {
          tableId: bill.table.id,
          status: "EMPTY",
          message: `${bill.table.tableName || "Masa " + bill.table.tableNumber} hesabı ödendi ve masa boşaltıldı.`
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
