import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * 🔒 P0-09 FIX: Service Requests API — Auth + Tenant Isolation
 *
 * POST: Disabled (use /api/customer/service-requests)
 * GET: requireWaiterOrAdmin(), businessId from session (NOT query string)
 */

export async function POST(request: NextRequest) {
  // ⚠️ KULLANIM DIŞI ENDPOINT - Güvenlik nedeniyle devre dışı bırakıldı
  // Müşteri hizmet talepleri için /api/customer/service-requests kullanılmalı
  return NextResponse.json(
    {
      error: "Bu endpoint kullanım dışı. Lütfen /api/customer/service-requests kullanın.",
      redirectTo: "/api/customer/service-requests"
    },
    { status: 410 } // Gone
  );
}

export async function GET(request: NextRequest) {
  try {
    // ✅ P0-09 FIX: Require authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    // ✅ P0-09 FIX: businessId from session (NOT from query string)
    const businessId = getBusinessId(session);

    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        businessId,
        // ✅ Ödeme talepleri Ödemeler sekmesinde gösterilir, Talepler sayfasına düşmemeli
        requestType: { not: "PAYMENT_REQUEST" },
      },
      include: {
        table: true,
        customerSession: {
          select: { id: true, authorizationStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ serviceRequests });
  } catch (error) {
    console.error("[SERVICE_REQUEST_LIST_ERROR]", error);
    return NextResponse.json(
      { error: "Talepler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
