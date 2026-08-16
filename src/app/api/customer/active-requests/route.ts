import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCustomerSessionToken } from "@/lib/customer-session-utils";

export const dynamic = "force-dynamic";

// GET /api/customer/active-requests — Token ile korunan müşteri talep durumu
export async function GET(request: NextRequest) {
  const securityHeaders = {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
  };

  try {
    const rawToken = request.headers.get("x-session-token");
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const businessId = searchParams.get("businessId");

    if (!tableId || !businessId) {
      return NextResponse.json({ activeRequests: {} }, { headers: securityHeaders });
    }

    // ✅ Token varsa sadece o oturumun taleplerini döndür
    let customerSessionId: string | null = null;
    if (rawToken) {
      // ✅ FIX: Hash the raw token before database lookup
      const tokenHash = hashCustomerSessionToken(rawToken);

      const customerSession = await prisma.customerSession.findUnique({
        where: { sessionToken: tokenHash },
        select: { id: true, tableId: true, businessId: true, status: true },
      });

      if (customerSession && customerSession.tableId === tableId && customerSession.businessId === businessId && customerSession.status === "ACTIVE") {
        customerSessionId = customerSession.id;
      }
    }

    // Token doğrulanmışsa sadece o oturumun taleplerini, yoksa genel masa taleplerini döndür
    const where: any = {
      tableId,
      businessId,
      status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
    };

    // Token korumalı: sadece bu oturumun taleplerini göster
    if (customerSessionId) {
      where.customerSessionId = customerSessionId;
    }

    const activeReqs = await prisma.serviceRequest.findMany({
      where,
      select: {
        requestType: true,
        status: true,
        createdAt: true,
        verificationCode: customerSessionId ? true : false,
        expiresAt: true,
        customerSessionId: true,
      },
    });

    const activeRequests: Record<string, boolean> = {};
    const requestDetails: Record<string, any> = {};

    for (const req of activeReqs) {
      activeRequests[req.requestType] = true;

      // ORDER_REQUEST için detay bilgisi
      if (req.requestType === "ORDER_REQUEST" && req.customerSessionId === customerSessionId) {
        requestDetails["ORDER_REQUEST"] = {
          verificationCode: (req as any).verificationCode || null,
          expiresAt: req.expiresAt?.toISOString() || null,
          status: req.status,
        };
      }
    }

    // Çakışma kontrolü
    const hasBlockingRequest = activeRequests["CALL_WAITER"] || activeRequests["PAYMENT_REQUEST"];
    if (hasBlockingRequest) {
      activeRequests["CALL_WAITER"] = activeRequests["CALL_WAITER"] || false;
      activeRequests["PAYMENT_REQUEST"] = activeRequests["PAYMENT_REQUEST"] || false;
      if (activeRequests["CALL_WAITER"]) activeRequests["PAYMENT_REQUEST_BLOCKED"] = true;
      if (activeRequests["PAYMENT_REQUEST"]) activeRequests["CALL_WAITER_BLOCKED"] = true;
    }

    return NextResponse.json({ activeRequests, requestDetails }, { headers: securityHeaders });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ activeRequests: {} }, { headers: securityHeaders });
  }
}
