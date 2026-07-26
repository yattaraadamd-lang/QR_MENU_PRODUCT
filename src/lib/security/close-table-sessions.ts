import { prisma } from "@/lib/prisma";

/**
 * Closes all active sessions when a table is closed or payment is completed
 * Must be called in a transaction to ensure data consistency
 */
export async function closeAllTableSessions(
  businessId: string,
  tableId: string,
  tx?: any // Prisma transaction client
) {
  const client = tx || prisma;

  // Close all active customer sessions and revoke authorizations
  await client.customerSession.updateMany({
    where: {
      tableId,
      businessId,
      status: "ACTIVE",
    },
    data: {
      status: "CLOSED",
      authorizationStatus: "REVOKED",
      closedAt: new Date(),
    },
  });

  // Cancel all pending service requests
  await client.serviceRequest.updateMany({
    where: {
      tableId,
      businessId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      resolvedAt: new Date(),
    },
  });

  // Update table status to EMPTY
  await client.table.update({
    where: { id: tableId },
    data: { status: "EMPTY" },
  });
}

/**
 * Closes table when payment is completed
 * Handles TableSession, Bill, and CustomerSession
 */
export async function closeTableOnPayment(
  businessId: string,
  tableId: string,
  tableSessionId: string,
  billId: string
) {
  await prisma.$transaction(async (tx) => {
    // Close table session
    await tx.tableSession.update({
      where: { id: tableSessionId },
      data: {
        status: "CLOSED",
        endedAt: new Date(),
        closeReason: "PAYMENT_COMPLETED",
      },
    });

    // Close bill
    await tx.bill.update({
      where: { id: billId },
      data: {
        status: "CLOSED",
        paymentStatus: "PAID",
        closedAt: new Date(),
      },
    });

    // Close all sessions
    await closeAllTableSessions(businessId, tableId, tx);
  });
}
