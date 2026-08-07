import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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
    deviceKeyHash: string | null;
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

// ✅ SECURITY: lastSeenAt throttle interval (5 minutes)
// Prevents write amplification from updating on every single request
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Hash a raw session token for database lookup.
 */
function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Validates a basic view session — active, not expired, table/business match.
 * Does NOT check authorization status.
 * Use for: ORDER_REQUEST creation (VIEW_ONLY or PENDING sessions).
 */
export async function validateViewSession(
  req: Request
): Promise<CustomerSessionValidationResult> {
  const rawToken = req.headers.get("x-session-token");

  if (!rawToken) {
    return {
      ok: false,
      status: 403,
      error: "Aktif müşteri oturumu bulunamadı. Lütfen QR kodu okutun.",
      code: "NO_SESSION_TOKEN",
    };
  }

  // ✅ SECURITY: Hash the raw token for database lookup
  const tokenHash = hashSessionToken(rawToken);

  const customerSession = await prisma.customerSession.findUnique({
    where: { sessionToken: tokenHash },
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
      code: "SESSION_NOT_FOUND",
    };
  }

  // ✅ Cihaz engeli kontrolü
  let deviceKeyHash = customerSession.deviceKeyHash;
  if (!deviceKeyHash) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/customer_device_id=([^;]+)/);
    if (match && match[1]) {
      const { hashDeviceKey } = await import("@/lib/security/device-block");
      deviceKeyHash = hashDeviceKey(match[1]);
    }
  }

  if (deviceKeyHash) {
    const { checkDeviceBlock } = await import("@/lib/security/device-block");
    const isBlocked = await checkDeviceBlock(customerSession.businessId, deviceKeyHash);
    if (isBlocked) {
      return {
        ok: false,
        status: 403,
        error: "Bu cihazın bu işletmede işlem yapması engellendi.",
        code: "CUSTOMER_DEVICE_BLOCKED",
      };
    }
  }

  // ✅ Check business is active
  if (!customerSession.business || !customerSession.business.isActive) {
    return {
      ok: false,
      status: 403,
      error: "İşletme şu anda hizmet vermiyor.",
      code: "BUSINESS_INACTIVE",
    };
  }

  if (customerSession.status !== "ACTIVE") {
    const code = customerSession.status === "REVOKED" ? "SESSION_REVOKED" : "SESSION_INACTIVE";
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
      code: "SESSION_EXPIRED",
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
      code: "TABLE_INACTIVE",
    };
  }

  // ✅ SECURITY: Throttled lastSeenAt update (every 5 minutes max)
  const timeSinceLastSeen = Date.now() - customerSession.lastSeenAt.getTime();
  if (timeSinceLastSeen > LAST_SEEN_THROTTLE_MS) {
    // Fire and forget — don't block the response
    prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => { /* non-critical */ });
  }

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

// ✅ P0-05 FIX: Legacy alias REMOVED
// validateCustomerActionSession was incorrectly mapping to validateViewSession,
// allowing VIEW_ONLY sessions to perform payment requests.
// Callers must now explicitly use validateViewSession or validateAuthorizedTableSession.
