import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { closeTable } from "@/lib/services/table-flow.service";

export const dynamic = "force-dynamic";

// POST /api/table-sessions/[id]/close — Admin veya garson masa oturumunu kapat
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let userRole = "WAITER";
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    userRole = session!.user.role || "WAITER";
    const body = await request.json().catch(() => ({}));
    const { forceClose, closeReason } = body;

    // ✅ Garson forceClose yapamaz
    if (forceClose && session!.user.role !== "ADMIN") {
      return NextResponse.json({
        error: "Ödenmemiş hesap varken masayı kapatmak için admin yetkisi gereklidir.",
        canForceClose: false,
      }, { status: 403 });
    }

    // ✅ Merkezi table-flow.service kullanarak transaction ile kapat
    const result = await closeTable(params.id, businessId, session!.user.id, {
      forceClose: forceClose || false,
      closeReason,
    });

    return NextResponse.json({ success: true, message: "Masa başarıyla kapatıldı" });
  } catch (e: any) {
    console.error("Masa kapatma hatası:", e);

    // Aktif sipariş hatası
    if (e.message?.includes("aktif sipariş")) {
      const match = e.message.match(/(\d+) aktif sipariş/);
      const count = match ? parseInt(match[1]) : 0;
      return NextResponse.json({
        error: e.message,
        activeOrderCount: count,
        canForceClose: userRole === "ADMIN",
      }, { status: userRole === "ADMIN" ? 400 : 403 });
    }

    // Ödenmemiş hesap hatası
    if (e.message?.includes("Ödenmemiş")) {
      return NextResponse.json({
        error: e.message,
        canForceClose: userRole === "ADMIN",
      }, { status: 400 });
    }

    // Oturum bulunamadı
    if (e.message?.includes("bulunamadı")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

