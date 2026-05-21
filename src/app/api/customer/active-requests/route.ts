import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/customer/active-requests?tableId=x&businessId=y
// Müşteri ekranında hangi talep türlerinin aktif olduğunu döner
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const businessId = searchParams.get("businessId");

    if (!tableId || !businessId) {
      return NextResponse.json({ activeRequests: {} });
    }

    // Aktif (PENDING veya SEEN) talepleri getir
    const activeReqs = await prisma.serviceRequest.findMany({
      where: {
        tableId,
        businessId,
        status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
      },
      select: { requestType: true, status: true, createdAt: true },
    });

    // Her talep tipi için aktif mi değil mi döner
    const activeRequests: Record<string, boolean> = {};
    for (const req of activeReqs) {
      activeRequests[req.requestType] = true;
    }

    // Çakışma kontrolü: CALL_WAITER veya PAYMENT_REQUEST aktifse diğerini de engelle
    const hasBlockingRequest = activeRequests["CALL_WAITER"] || activeRequests["PAYMENT_REQUEST"];
    if (hasBlockingRequest) {
      activeRequests["CALL_WAITER"] = activeRequests["CALL_WAITER"] || false;
      activeRequests["PAYMENT_REQUEST"] = activeRequests["PAYMENT_REQUEST"] || false;
      // Her ikisini de engelle (biri aktifse diğeri de pasif olmalı)
      if (activeRequests["CALL_WAITER"]) activeRequests["PAYMENT_REQUEST_BLOCKED"] = true;
      if (activeRequests["PAYMENT_REQUEST"]) activeRequests["CALL_WAITER_BLOCKED"] = true;
    }

    return NextResponse.json({ activeRequests });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ activeRequests: {} });
  }
}
