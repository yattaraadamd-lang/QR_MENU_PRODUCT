import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

const EVENT_LIMIT = 30;

// GET /api/admin/tables/[id]/events - Masanın son durum değişiklikleri
export const GET = withApiHandler("GET /api/admin/tables/[id]/events", handleGet);

async function handleGet(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  const { error, response, session } = await requireAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);

  const table = await prisma.table.findFirst({
    where: { id: params.id, businessId },
    select: { id: true },
  });
  if (!table) {
    return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });
  }

  const events = await prisma.tableEvent.findMany({
    where: { tableId: table.id, businessId },
    orderBy: { createdAt: "desc" },
    take: EVENT_LIMIT,
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      source: true,
      reason: true,
      actorUserId: true,
      createdAt: true,
    },
  });

  // Silinmiş personelin adı bulunamaz; kayıt yine görünür
  const actorIds = [...new Set(events.flatMap((event) => (event.actorUserId ? [event.actorUserId] : [])))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds }, businessId }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((actor) => [actor.id, actor.name]));

  return NextResponse.json({
    events: events.map(({ actorUserId, ...event }) => ({
      ...event,
      actorName: actorUserId ? actorName.get(actorUserId) ?? null : null,
    })),
  });
}
