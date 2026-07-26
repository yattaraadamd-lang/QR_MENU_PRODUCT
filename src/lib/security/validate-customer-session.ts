import { prisma } from "@/lib/prisma";

export type CustomerSessionValidationSuccess = {
  ok: true;
  customerSession: {
    id: string;
    businessId: string;
    tableId: string;
    tableSessionId: string | null;
    sessionToken: string;
    status: string;
    authorizationStatus: string;
    authorizedAt: Date | null;
    expiresAt: Date;
    lastSeenAt: Date;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    table: any;
    business: any;
    tableSession: any;
  };
};

export type CustomerSessionValidationError = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type CustomerSessionValidationResult =
  | CustomerSessionValidationSuccess
  | CustomerSessionValidationError;

/**
 * Validates a basic view session — active, not expired, table/business match.
 * Does NOT check authorization status.
 * Use for: ORDER_REQUEST creation (VIEW_ONLY or PENDING sessions).
 */
export async function validateViewSession(
  req: Request
): Promise<CustomerSessionValidationResult> {
  const sessionToken = req.headers.get("x-session-token");

  if (!sessionToken) {
    return {
      ok: false,
      status: 403,
      error: "Aktif müşteri oturumu bulunamadı. Lütfen QR kodu okutun.",
      code: "VIEW_ONLY_SESSION",
    };
  }

  const customerSession = await prisma.customerSession.findUnique({
    where: { sessionToken },
    include: {
      table: true,
      business: true,
      tableSession: true,
    },
  });

  if (!customerSession) {
    return {
      ok: false,
      status: 403,
      error: "Müşteri oturumu bulunamadı. Lütfen QR kodu tekrar okutun.",
      code: "VIEW_ONLY_SESSION",
    };
  }

  if (customerSession.status !== "ACTIVE") {
    const code = customerSession.status === "REVOKED" ? "SESSION_REVOKED" : "VIEW_ONLY_SESSION";
    return {
      ok: false,
      status: 403,
      error: customerSession.status === "REVOKED"
        ? "Bu oturum iptal edilmiş. Personelden yardım isteyin."
        : "Müşteri oturumu aktif değil. Bu masa kapatılmış olabilir.",
      code,
    };
  }

  if (customerSession.expiresAt < new Date()) {
    await prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { status: "EXPIRED", closedAt: new Date() },
    });

    return {
      ok: false,
      status: 403,
      error: "Müşteri oturumunun süresi dolmuş. Lütfen QR kodu tekrar okutun.",
      code: "VIEW_ONLY_SESSION",
    };
  }

  if (!customerSession.table) {
    return {
      ok: false,
      status: 403,
      error: "Masa bulunamadı.",
    };
  }

  if (customerSession.table.isDeleted || !customerSession.table.isActive) {
    return {
      ok: false,
      status: 403,
      error: "Bu masa aktif değil veya silinmiş.",
    };
  }

  // Update last seen
  await prisma.customerSession.update({
    where: { id: customerSession.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    ok: true,
    customerSession: {
      ...customerSession,
      table: customerSession.table,
      business: customerSession.business,
      tableSession: customerSession.tableSession,
    },
  };
}

/**
 * Validates an authorized table session — all view checks plus:
 * - authorizationStatus === AUTHORIZED
 * - tableSessionId is set
 * - linked TableSession.status === ACTIVE
 * - TableSession.tableId/businessId matches customer session
 *
 * Use for: orders, CALL_WAITER, PAYMENT_REQUEST, CLEANING_REQUEST, etc.
 */
export async function validateAuthorizedTableSession(
  req: Request
): Promise<CustomerSessionValidationResult> {
  const viewResult = await validateViewSession(req);
  if (!viewResult.ok) return viewResult;

  const { customerSession } = viewResult;

  if (customerSession.authorizationStatus === "REVOKED") {
    return {
      ok: false,
      status: 403,
      error: "Bu oturumun yetkisi iptal edilmiş. Personelden yardım isteyin.",
      code: "SESSION_REVOKED",
    };
  }

  if (customerSession.authorizationStatus !== "AUTHORIZED") {
    return {
      ok: false,
      status: 403,
      error: "Bu masa başka bir aktif oturuma ait veya henüz garson onayı alınmamış.",
      code: "SESSION_NOT_AUTHORIZED_FOR_TABLE",
    };
  }

  if (!customerSession.tableSessionId) {
    return {
      ok: false,
      status: 403,
      error: "Bu oturum bir masaya bağlı değil. Lütfen garson çağırın.",
      code: "SESSION_NOT_AUTHORIZED_FOR_TABLE",
    };
  }

  if (!customerSession.tableSession || customerSession.tableSession.status !== "ACTIVE") {
    // Table session closed — revoke authorization
    await prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { authorizationStatus: "REVOKED" },
    });
    return {
      ok: false,
      status: 403,
      error: "Masa oturumu kapatılmış. Personelden yardım isteyin.",
      code: "SESSION_NOT_AUTHORIZED_FOR_TABLE",
    };
  }

  // Verify table session belongs to same table/business
  if (
    customerSession.tableSession.tableId !== customerSession.tableId ||
    customerSession.tableSession.businessId !== customerSession.businessId
  ) {
    return {
      ok: false,
      status: 403,
      error: "Oturum masa bilgisi uyuşmuyor.",
      code: "SESSION_NOT_AUTHORIZED_FOR_TABLE",
    };
  }

  return viewResult;
}

/**
 * Legacy compatibility — maps to validateViewSession for backward compatibility.
 * Callers should migrate to validateViewSession or validateAuthorizedTableSession.
 */
export async function validateCustomerActionSession(
  req: Request
): Promise<CustomerSessionValidationResult> {
  return validateViewSession(req);
}
