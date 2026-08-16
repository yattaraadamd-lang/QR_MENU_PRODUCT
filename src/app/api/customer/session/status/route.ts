import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCustomerSessionToken } from "@/lib/customer-session-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/customer/session/status
 *
 * Canonical read-only endpoint for customer session state.
 *
 * Token source: `x-session-token` header ONLY (never URL query).
 *
 * Validation order:
 *  1. Header token present
 *  2. Hash → find CustomerSession
 *  3. Session status === ACTIVE
 *  4. expiresAt not passed
 *  5. authorizationStatus !== REVOKED
 *  6. If AUTHORIZED → linked TableSession is ACTIVE
 *  7. business / table consistency
 */
export async function GET(request: NextRequest) {
  const securityHeaders = {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
  };

  try {
    // 1. Token from header
    const rawToken = request.headers.get("x-session-token");
    if (!rawToken) {
      return NextResponse.json(
        { error: "Oturum tokenı gerekli.", code: "SESSION_TOKEN_REQUIRED" },
        { status: 401, headers: securityHeaders }
      );
    }

    // 2. Hash and lookup
    const tokenHash = hashCustomerSessionToken(rawToken);
    const session = await prisma.customerSession.findUnique({
      where: { sessionToken: tokenHash },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Oturum bulunamadı.", code: "SESSION_NOT_FOUND" },
        { status: 401, headers: securityHeaders }
      );
    }

    // 3. Session ACTIVE check
    if (session.status !== "ACTIVE") {
      // REVOKED is handled specifically below; everything else is inactive
      if (session.status === "REVOKED" || session.authorizationStatus === "REVOKED") {
        return NextResponse.json(
          {
            valid: false,
            authorizationStatus: "REVOKED",
            code: "SESSION_REVOKED",
          },
          { status: 403, headers: securityHeaders }
        );
      }
      return NextResponse.json(
        { error: "Oturum aktif değil.", code: "SESSION_NOT_FOUND" },
        { status: 401, headers: securityHeaders }
      );
    }

    // 4. Expiry
    if (new Date() > session.expiresAt) {
      await prisma.customerSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Oturum süresi doldu.", code: "SESSION_EXPIRED" },
        { status: 401, headers: securityHeaders }
      );
    }

    // 5. REVOKED authorization
    if (session.authorizationStatus === "REVOKED") {
      return NextResponse.json(
        {
          valid: false,
          authorizationStatus: "REVOKED",
          code: "SESSION_REVOKED",
        },
        { status: 403, headers: securityHeaders }
      );
    }

    // 6. If AUTHORIZED, verify linked TableSession
    let tableSessionActive = true;
    if (session.authorizationStatus === "AUTHORIZED") {
      if (!session.tableSessionId) {
        tableSessionActive = false;
      } else {
        const tableSession = await prisma.tableSession.findUnique({
          where: { id: session.tableSessionId },
        });
        if (!tableSession || tableSession.status !== "ACTIVE") {
          tableSessionActive = false;
        }
        // 7. Business / table consistency
        if (
          tableSession &&
          (tableSession.businessId !== session.businessId ||
            tableSession.tableId !== session.tableId)
        ) {
          return NextResponse.json(
            {
              error: "Oturum ile masa eşleşmiyor.",
              code: "SESSION_TABLE_MISMATCH",
            },
            { status: 403, headers: securityHeaders }
          );
        }
      }

      if (!tableSessionActive) {
        return NextResponse.json(
          {
            valid: false,
            authorizationStatus: session.authorizationStatus,
            code: "TABLE_SESSION_NOT_ACTIVE",
          },
          { status: 409, headers: securityHeaders }
        );
      }
    }

    // Check for pending ORDER_REQUEST (so frontend knows not to create another)
    let orderRequestStatus: string | null = null;
    const pendingOrderRequest = await prisma.serviceRequest.findFirst({
      where: {
        customerSessionId: session.id,
        requestType: "ORDER_REQUEST",
        status: { in: ["PENDING", "SEEN"] },
      },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    if (pendingOrderRequest) {
      orderRequestStatus = pendingOrderRequest.status;
    }

    return NextResponse.json(
      {
        valid: true,
        authorizationStatus: session.authorizationStatus,
        tableSessionId: session.tableSessionId || null,
        customerSessionId: session.id,
        tableId: session.tableId,
        businessId: session.businessId,
        orderRequestStatus,
      },
      { headers: securityHeaders }
    );
  } catch (error) {
    console.error("[session/status] Error:", (error as any)?.code);
    return NextResponse.json(
      { error: "Durum kontrol hatası", code: "INTERNAL_ERROR" },
      { status: 500, headers: securityHeaders }
    );
  }
}
