import "server-only";
import { prisma } from "@/lib/prisma";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { writeTableStatus, type TableChangeCause } from "@/lib/services/table-events.service";

export class OrderRequestApprovalError extends Error {
  constructor(public readonly code: "ALREADY_HANDLED" | "TABLE_ALREADY_HAS_SESSION") {
    super(code);
    this.name = "OrderRequestApprovalError";
  }
}

interface ApprovableRequest {
  readonly id: string;
  readonly businessId: string;
  readonly tableId: string;
  readonly customerSessionId: string;
  readonly table: { readonly tableNumber: string; readonly tableName: string | null };
}

/**
 * Sipariş talebini onaylayıp masayı açar: masa yalnız buradan (garson onayı ya da demoda sistem
 * onayı) dolar. Çağıran; yetkiyi, doğrulama kodunu ve talebin süresini denetlemiş olmalıdır.
 *
 * Tek transaction içinde: oturum + adisyon açılır, masa OCCUPIED olur, talebi oluşturan cihaz
 * AUTHORIZED olur, aynı masadaki diğer yetkiler ve bekleyen talepler iptal edilir.
 *
 * Eşzamanlı onayda ikinci oturumu kısmi unique indeks reddeder (P2002); çağıran bunu ele alır.
 */
export async function approveOrderRequest(request: ApprovableRequest, cause: TableChangeCause) {
  const { id: requestId, businessId, tableId, customerSessionId, table } = request;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Talebi kilitle ve tekrar kontrol et
    const lockedRequest = await tx.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!lockedRequest || (lockedRequest.status !== "PENDING" && lockedRequest.status !== "SEEN")) {
      throw new OrderRequestApprovalError("ALREADY_HANDLED");
    }

    // 2. Masa için başka aktif TableSession olmadığını doğrula
    const existingActiveSession = await tx.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
    });

    if (existingActiveSession) {
      throw new OrderRequestApprovalError("TABLE_ALREADY_HAS_SESSION");
    }

    // 3. TableSession + Bill oluştur
    const tableSession = await tx.tableSession.create({
      data: { businessId, tableId, status: "ACTIVE" },
    });

    const bill = await tx.bill.create({
      data: {
        businessId,
        tableId,
        tableSessionId: tableSession.id,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: "UNPAID",
        status: "OPEN",
      },
    });

    // 4. Masa durumunu OCCUPIED yap
    await writeTableStatus(tx, { businessId, tableId }, "OCCUPIED", { ...cause, customerSessionId });

    // 5. Talebi oluşturan CustomerSession'ı AUTHORIZED yap
    await tx.customerSession.update({
      where: { id: customerSessionId },
      data: {
        authorizationStatus: "AUTHORIZED",
        tableSessionId: tableSession.id,
        authorizedAt: new Date(),
      },
    });

    // 6. Aynı masadaki diğer CustomerSession'ların eski yetkilerini REVOKED yap
    await tx.customerSession.updateMany({
      where: {
        tableId,
        businessId,
        status: "ACTIVE",
        id: { not: customerSessionId },
        authorizationStatus: { in: ["AUTHORIZED", "PENDING"] },
      },
      data: { authorizationStatus: "REVOKED" },
    });

    // 7. Diğer bekleyen ORDER_REQUEST kayıtlarını iptal et
    await tx.serviceRequest.updateMany({
      where: {
        tableId,
        requestType: "ORDER_REQUEST",
        status: { in: ["PENDING", "SEEN"] },
        id: { not: requestId },
      },
      data: { status: "CANCELLED" },
    });

    // 8. Onaylanan talebi COMPLETED yap
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { tableSession: { ...tableSession, bill }, bill };
  });

  // Socket hatası onayı geri almaz
  try {
    // Garson ekranlarını güncelle
    emitToBusinessRoom(businessId, "table_opened", {
      tableId,
      tableNumber: table.tableNumber,
      tableName: table.tableName,
      tableSessionId: result.tableSession.id,
      requestId,
      message: `${table.tableName || "Masa " + table.tableNumber} açıldı`,
    });

    // Müşteri oturumunu güncelle
    emitToBusinessRoom(businessId, "session_authorized", {
      tableId,
      customerSessionId,
      tableSessionId: result.tableSession.id,
      authorizationStatus: "AUTHORIZED",
    });
  } catch (e) {
    console.log("Socket emit hatası:", e);
  }

  return result;
}
