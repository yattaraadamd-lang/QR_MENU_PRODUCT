/**
 * Masa Oturumu (TableSession) Yardımcıları
 *
 * Kurallar:
 * - Masa sadece sipariş kabul edilince dolar (TableSession ACTIVE olur).
 * - QR sayfasını açmak / yenilemek masa durumunu ASLA değiştirmez.
 * - Masa kapatılınca aktif oturum CLOSED olur, masa EMPTY olur; qrToken korunur.
 * - Aynı masa için aynı anda tek bir ACTIVE oturum olabilir (satır kilidi ile garanti).
 */

import { Prisma, TableStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Masa satırını transaction sonuna kadar kilitler.
 * Eşzamanlı iki istek aynı masa için iki ACTIVE oturum açamaz.
 */
async function lockTable(tx: Tx, tableId: string) {
  await tx.$queryRaw`SELECT id FROM "tables" WHERE id = ${tableId} FOR UPDATE`;
}

/**
 * Aktif oturumu döndürür; yoksa oturum + adisyon oluşturur ve masayı HAS_ORDER yapar.
 * Mutlaka prisma.$transaction içinde çağrılmalıdır.
 */
export async function getOrCreateActiveTableSession(
  tx: Tx,
  businessId: string,
  tableId: string
) {
  await lockTable(tx, tableId);

  const existing = await tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    include: { bill: true },
  });
  if (existing) return existing;

  const created = await tx.tableSession.create({
    data: {
      businessId,
      tableId,
      status: "ACTIVE",
      bill: {
        create: {
          businessId,
          tableId,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: "UNPAID",
          status: "OPEN",
        },
      },
    },
    include: { bill: true },
  });

  await tx.table.update({
    where: { id: tableId },
    data: { status: TableStatus.HAS_ORDER },
  });

  return created;
}

/**
 * Masanın aktif oturumunu kapatır ve masayı EMPTY yapar.
 * qrToken, isActive ve masa kaydı DEĞİŞTİRİLMEZ.
 * Mutlaka prisma.$transaction içinde çağrılmalıdır.
 */
export async function closeTableSession(
  tx: Tx,
  params: {
    businessId: string;
    tableSessionId: string;
    tableId: string;
    closedById: string;
    closeReason?: string | null;
    forceClose?: boolean;
  }
) {
  const { businessId, tableSessionId, tableId, closedById, closeReason, forceClose } = params;

  await lockTable(tx, tableId);
  const now = new Date();

  await tx.tableSession.update({
    where: { id: tableSessionId },
    data: {
      status: "CLOSED",
      endedAt: now,
      closedById,
      closeReason: closeReason ?? null,
    },
  });

  const bill = await tx.bill.findUnique({ where: { tableSessionId } });
  if (bill) {
    const remaining = Number(bill.remainingAmount);
    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: "CLOSED",
        closedAt: now,
        paymentStatus: remaining <= 0 ? "PAID" : forceClose ? "CANCELLED" : "UNPAID",
      },
    });
  }

  await tx.table.update({
    where: { id: tableId },
    data: { status: TableStatus.EMPTY },
  });

  // Eski müşteri sekmesi masa kapandıktan sonra sipariş veremesin
  await tx.customerSession.updateMany({
    where: { tableId, businessId, status: "ACTIVE" },
    data: { status: "CLOSED" },
  });

  await tx.serviceRequest.updateMany({
    where: { tableId, businessId, status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
    data: { status: "COMPLETED", completedAt: now },
  });
}

/**
 * Sipariş iptal/red sonrası masanın durumunu belirler.
 * Aktif oturum yoksa masa EMPTY kalır — iptal edilen sipariş masayı doldurmaz.
 */
export async function tableStatusAfterOrderRemoved(
  tx: Tx,
  businessId: string,
  tableId: string
): Promise<TableStatus> {
  const activeSession = await tx.tableSession.findFirst({
    where: { tableId, businessId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!activeSession) return TableStatus.EMPTY;

  const activeOrders = await tx.order.count({
    where: { tableId, businessId, status: { in: ["ACCEPTED", "PREPARING"] } },
  });
  return activeOrders > 0 ? TableStatus.HAS_ORDER : TableStatus.OCCUPIED;
}
