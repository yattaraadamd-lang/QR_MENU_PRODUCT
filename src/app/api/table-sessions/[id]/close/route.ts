import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { closeTableSession } from "@/lib/table-session";

export const dynamic = "force-dynamic";

// POST /api/table-sessions/[id]/close — Admin veya garson masa oturumunu kapat
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const body = await request.json().catch(() => ({}));
    const { forceClose, closeReason } = body;

    const tableSession = await prisma.tableSession.findFirst({
      where: { id: params.id, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (!tableSession) return NextResponse.json({ error: "Aktif oturum bulunamadı" }, { status: 404 });

    // Ödenmemiş hesap kontrolü
    const bill = tableSession.bill;
    if (bill && Number(bill.remainingAmount) > 0 && !forceClose) {
      return NextResponse.json({
        error: "Bu masa kapatılamaz. Ödenmemiş hesap var.",
        remainingAmount: Number(bill.remainingAmount),
        canForceClose: session!.user.role === "ADMIN",
      }, { status: 400 });
    }

    // ✅ Zorla kapatma sadece ADMIN yapabilir
    if (forceClose && session!.user.role !== "ADMIN") {
      return NextResponse.json({
        error: "Ödenmemiş hesap varken masayı kapatmak için admin yetkisi gereklidir.",
        canForceClose: false,
      }, { status: 403 });
    }

    // ✅ Oturum + adisyon kapanır, masa EMPTY olur — qrToken SİLİNMEZ (kalıcı QR kimliği)
    await prisma.$transaction((tx) =>
      closeTableSession(tx, {
        businessId,
        tableSessionId: tableSession.id,
        tableId: tableSession.tableId,
        closedById: session!.user.id,
        closeReason: forceClose ? (closeReason || "Admin tarafından kapatıldı") : null,
        forceClose: !!forceClose,
      })
    );

    return NextResponse.json({ success: true, message: "Masa başarıyla kapatıldı" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

