import "server-only";
import { prisma } from "@/lib/prisma";
import { DEMO_IDLE_RELEASE_MS } from "@/lib/demo";
import { closeTable } from "@/lib/services/table-flow.service";

/**
 * Demo masasının oturumu boşta kaldıysa kapatır. Son etkinlik, masaya yetkili cihazların son görülme
 * zamanı; yetkili cihaz yoksa (personel açtıysa) oturumun başlangıcıdır.
 * Yalnız geçerli QR ile gelen yeni bir cihaz tetikler. true: masa kapatıldı.
 */
export async function releaseIdleDemoTable(tableId: string, businessId: string): Promise<boolean> {
  const active = await prisma.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    select: {
      id: true,
      startedAt: true,
      customerSessions: {
        where: { status: "ACTIVE", authorizationStatus: "AUTHORIZED" },
        select: { lastSeenAt: true },
      },
    },
  });
  if (!active) return false;

  const lastActivity = Math.max(
    active.startedAt.getTime(),
    ...active.customerSessions.map((session) => session.lastSeenAt.getTime()),
  );
  if (Date.now() - lastActivity < DEMO_IDLE_RELEASE_MS) return false;

  await closeTable(active.id, businessId, null, {
    forceClose: true,
    closeReason: "Demo masası boşta kaldı",
    eventReason: "DEMO_IDLE_RELEASE",
  });
  return true;
}
