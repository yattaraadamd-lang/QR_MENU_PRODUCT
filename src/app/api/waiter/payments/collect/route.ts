import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { collectPayment } from "@/lib/services/table-flow.service";

export const dynamic = "force-dynamic";

// POST /api/waiter/payments/collect — Ödeme al (admin + garson)
export async function POST(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const body = await request.json();
    const { tableSessionId, amount, method, note, receivedAmount } = body;

    if (!tableSessionId || !amount || !method) {
      return NextResponse.json({ error: "tableSessionId, amount ve method gerekli" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz tutar" }, { status: 400 });
    }

    // ✅ Nakit ödeme için validasyon
    if (method === "CASH") {
      if (!receivedAmount || typeof receivedAmount !== "number" || receivedAmount <= 0) {
        return NextResponse.json({ error: "Nakit ödeme için alınan tutar belirtilmelidir" }, { status: 400 });
      }
      
      if (receivedAmount < amount) {
        return NextResponse.json({ 
          error: `Alınan tutar (₺${receivedAmount.toFixed(2)}), ödenmesi gereken tutardan (₺${amount.toFixed(2)}) küçük olamaz` 
        }, { status: 400 });
      }
    }

    // ✅ Merkezi table-flow.service kullanarak transaction ile ödeme al
    // bill.totalAmount server-side hesaplanır, client'a güvenilmez
    const result = await collectPayment(
      tableSessionId,
      businessId,
      amount,
      method,
      session!.user.id,
      session!.user.name,
      note || null
    );

    // Socket.IO bildirimi — transaction dışında
    try {
      emitToBusinessRoom(businessId, "payment_collected", {
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        amount,
        method,
        remainingAmount: Number(result.bill.remainingAmount),
        paymentStatus: result.bill.paymentStatus,
      });
    } catch { /* socket opsiyonel */ }

    return NextResponse.json({ payment: result.payment, bill: result.bill }, { status: 201 });
  } catch (e: any) {
    console.error("Ödeme alma hatası:", e);

    // ✅ Business logic errors should return 400, not 500
    if (e.message?.includes("bulunamadı")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    
    if (e.message?.includes("0 veya negatif") || e.message?.includes("geçersiz") || e.message?.includes("Kalan borç")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
