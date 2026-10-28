import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { openTable } from "@/lib/services/table-flow.service";
import { withApiHandler, parseJson, parseQuery } from "@/lib/api/handler";
import { tableSessionQuerySchema, tableSessionCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/table-sessions?tableId=xxx — Aktif oturumu getir
export const GET = withApiHandler("GET /api/table-sessions", handleGet);

async function handleGet(request: NextRequest) {
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);
  const { tableId } = parseQuery(request, tableSessionQuerySchema);

  if (!tableId) return NextResponse.json({ error: "tableId gerekli" }, { status: 400 });

  const tableSession = await prisma.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: {
      bill: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({ tableSession });
}

// POST /api/table-sessions — Yeni oturum başlat (SADECE garson veya admin)
export const POST = withApiHandler("POST /api/table-sessions", handlePost);

async function handlePost(request: NextRequest) {
  // ✅ Authentication zorunlu — müşteri bu endpoint'i kullanamaz
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;
  const authenticatedBusinessId = getBusinessId(session);

  const { businessId, tableId } = await parseJson(request, tableSessionCreateSchema);

  if (!businessId || !tableId) {
    return NextResponse.json({ error: "businessId ve tableId gerekli" }, { status: 400 });
  }

  // ✅ Güvenlik: kullanıcı sadece kendi işletmesi için masa açabilir
  if (businessId !== authenticatedBusinessId) {
    return NextResponse.json(
      { error: "Bu işletme için yetkiniz yok" },
      { status: 403 }
    );
  }

  // ✅ Merkezi table-flow.service kullanarak transaction ile masa aç
  // NOT: Bu endpoint müşteri yetkilendirmesi YAPMAZ.
  // Müşteri talebinden açılış yalnız /api/waiter/service-requests/[id]/open-table üzerinden yapılır.
  let result;
  try {
    result = await openTable(tableId, businessId);
  } catch (e) {
    // openTable olmayan/pasif masada düz Error atar; diğer hatalar withApiHandler'da 500 olur
    if (e instanceof Error && e.message.includes("bulunamadı")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json(
    { tableSession: result.tableSession, bill: result.bill, isNew: result.isNew },
    { status: result.isNew ? 201 : 200 }
  );
}
