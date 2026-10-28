import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { closeTable, TableCloseError } from "@/lib/services/table-flow.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { tableSessionCloseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/table-sessions/[id]/close — Admin veya garson masa oturumunu kapat
export const POST = withApiHandler("POST /api/table-sessions/[id]/close", handlePost);

async function handlePost(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);
  const isAdmin = session!.user.role === "ADMIN";
  // Garson ekranı gövdesiz gönderir
  const { forceClose, closeReason } = await parseJson(request, tableSessionCloseSchema, { optional: true });

  // ✅ Garson forceClose yapamaz
  if (forceClose && !isAdmin) {
    return NextResponse.json({
      error: "Ödenmemiş hesap varken masayı kapatmak için admin yetkisi gereklidir.",
      canForceClose: false,
    }, { status: 403 });
  }

  // ✅ Merkezi table-flow.service kullanarak transaction ile kapat
  try {
    await closeTable(params.id, businessId, session!.user.id, {
      forceClose: forceClose || false,
      closeReason: closeReason || undefined,
    });
  } catch (e) {
    if (!(e instanceof TableCloseError)) throw e;

    // Tamamlanmamış sipariş: admin zorla kapatabilir (ekran canForceClose ile seçeneği açar)
    if (e.code === "UNFINISHED_ORDERS") {
      return NextResponse.json({
        error: e.message,
        activeOrderCount: e.unfinishedOrderCount,
        canForceClose: isAdmin,
      }, { status: isAdmin ? 400 : 403 });
    }

    if (e.code === "UNPAID_BALANCE") {
      return NextResponse.json({ error: e.message, canForceClose: isAdmin }, { status: 400 });
    }

    return NextResponse.json({ error: e.message }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Masa başarıyla kapatıldı" });
}
