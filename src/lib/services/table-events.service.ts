import "server-only";
import type { Prisma, TableEventSource, TableStatus } from "@prisma/client";

/** Durum değişikliğinin nedeni; ekrandaki metinler components/admin-tables/tableEventModel.ts'te */
export type TableEventReason =
  | "TABLE_OPENED"
  | "ORDER_REQUEST_APPROVED"
  | "ORDER_REQUEST_AUTO_APPROVED"
  | "ORDER_REQUEST_REJECTED"
  | "ORDER_ACCEPTED"
  | "ORDER_PREPARING"
  | "ORDER_SERVED"
  | "ORDER_CANCELLED"
  | "WAITER_CALLED"
  | "REQUEST_RESOLVED"
  | "PAYMENT_REQUESTED"
  | "PAYMENT_COMPLETED"
  | "TABLE_CLOSED"
  | "TABLE_FORCE_CLOSED"
  | "DEMO_IDLE_RELEASE"
  | "MANUAL_STATUS";

/** Kim, neden: masa durumunu değiştiren her çağrı bunu bildirmek zorundadır */
export interface TableChangeCause {
  readonly source: TableEventSource;
  readonly reason: TableEventReason;
  readonly actorUserId?: string | null;
  readonly customerSessionId?: string | null;
}

/**
 * Masa durumunun tek yazıcısı: değişiklik varsa durum ve olay kaydı aynı transaction'da yazılır,
 * biri olmadan diğeri kalmaz. Durum aynıysa hiçbir şey yazılmaz.
 */
export async function writeTableStatus(
  tx: Prisma.TransactionClient,
  target: { businessId: string; tableId: string },
  toStatus: TableStatus,
  cause: TableChangeCause
): Promise<TableStatus> {
  const { businessId, tableId } = target;
  const table = await tx.table.findFirst({ where: { id: tableId, businessId }, select: { status: true } });
  if (!table) throw new Error("Masa bulunamadı");
  if (table.status === toStatus) return toStatus;

  await tx.table.update({ where: { id: tableId }, data: { status: toStatus } });
  await tx.tableEvent.create({
    data: {
      businessId,
      tableId,
      fromStatus: table.status,
      toStatus,
      source: cause.source,
      reason: cause.reason,
      actorUserId: cause.actorUserId ?? null,
      customerSessionId: cause.customerSessionId ?? null,
    },
  });
  return toStatus;
}
