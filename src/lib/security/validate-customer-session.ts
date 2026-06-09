import { prisma } from "@/lib/prisma";

export type CustomerSessionValidationSuccess = {
  ok: true;
  customerSession: {
    id: string;
    businessId: string;
    tableId: string;
    sessionToken: string;
    status: string;
    expiresAt: Date;
    lastSeenAt: Date;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    table: any;
    business: any;
  };
};

export type CustomerSessionValidationError = {
  ok: false;
  status: number;
  error: string;
};

export type CustomerSessionValidationResult =
  | CustomerSessionValidationSuccess
  | CustomerSessionValidationError;

/**
 * Validates customer session for protected actions (order, service request, payment)
 * Returns session data if valid, error object if invalid
 * 
 * NOTE: This does NOT check if table.status === "EMPTY"
 * That check is context-specific:
 * - For ORDERS: EMPTY is OK (first order will activate table)
 * - For SERVICE_REQUESTS: EMPTY might be OK (depends on request type)
 * - For PAYMENT_REQUESTS: EMPTY is NOT OK (must have active session with orders)
 */
export async function validateCustomerActionSession(
  req: Request
): Promise<CustomerSessionValidationResult> {
  const sessionToken = req.headers.get("x-session-token");

  if (!sessionToken) {
    return {
      ok: false,
      status: 403,
      error: "Aktif müşteri oturumu bulunamadı. Lütfen QR kodu okutun.",
    };
  }

  const customerSession = await prisma.customerSession.findUnique({
    where: { sessionToken },
    include: {
      table: true,
      business: true,
    },
  });

  if (!customerSession) {
    return {
      ok: false,
      status: 403,
      error: "Müşteri oturumu bulunamadı. Lütfen QR kodu tekrar okutun.",
    };
  }

  if (customerSession.status !== "ACTIVE") {
    return {
      ok: false,
      status: 403,
      error: "Müşteri oturumu aktif değil. Bu masa kapatılmış olabilir.",
    };
  }

  if (customerSession.expiresAt < new Date()) {
    // Auto-expire session
    await prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { status: "EXPIRED", closedAt: new Date() },
    });

    return {
      ok: false,
      status: 403,
      error: "Müşteri oturumunun süresi dolmuş. Lütfen QR kodu tekrar okutun.",
    };
  }

  if (!customerSession.table) {
    return {
      ok: false,
      status: 403,
      error: "Masa bulunamadı.",
    };
  }

  // ✅ REMOVED: Table EMPTY check
  // This is handled per-endpoint based on context:
  // - Orders: EMPTY is OK (first order activates table)
  // - Service requests: Depends on type
  // - Payment requests: EMPTY is not OK

  // Validate table is not deleted/inactive
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
    },
  };
}

/**
 * Validates customer session with optional geolocation check
 */
export async function validateCustomerActionSessionWithLocation(
  req: Request,
  latitude?: number,
  longitude?: number
) {
  const sessionCheck = await validateCustomerActionSession(req);

  if (!sessionCheck.ok) {
    return sessionCheck;
  }

  const { customerSession } = sessionCheck;

  // If geolocation provided and business has location configured
  if (
    latitude &&
    longitude &&
    customerSession.business.latitude &&
    customerSession.business.longitude
  ) {
    const distance = calculateDistance(
      latitude,
      longitude,
      customerSession.business.latitude,
      customerSession.business.longitude
    );

    const allowedRadius = customerSession.business.allowedRadiusMeters || 100;

    if (distance > allowedRadius) {
      return {
        ok: false,
        status: 403,
        error: `Bu hizmeti sadece restoran içerisindeyken kullanabilirsiniz. (Mesafe: ${Math.round(distance)}m)`,
      };
    }
  }

  return sessionCheck;
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
