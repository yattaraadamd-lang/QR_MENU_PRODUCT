import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * 🔒 P0-09 FIX: Service Requests API — Auth + Tenant Isolation
 *
 * POST: Disabled (use /api/customer/service-requests)
 * GET: Yalnız admin (talepler ekranı), businessId session'dan (query string'den değil).
 * Doğrulama kodunu içerir: admin kodu yazmadan masa açar. Garson /api/waiter/service-requests
 * kullanır ve kodu müşteriden sorar; bu uç garsona açılırsa o denetim anlamsızlaşır.
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

export const GET = withApiHandler("GET /api/service-requests", handleGet);

async function handleGet(request: NextRequest) {
  const { error, response, session } = await requireAdmin();
  if (error) return response!;

  // ✅ P0-09 FIX: businessId from session (NOT from query string)
  const businessId = getBusinessId(session);

  const serviceRequests = await prisma.serviceRequest.findMany({
    where: {
      businessId,
      // ✅ Ödeme talepleri Ödemeler sekmesinde gösterilir, Talepler sayfasına düşmemeli
      requestType: { not: "PAYMENT_REQUEST" },
    },
    // Ekran bu alanları kullanır (components/admin-requests/types.ts)
    select: {
      id: true,
      tableId: true,
      requestType: true,
      status: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      orderPreview: true,
      verificationCode: true,
      completedAt: true,
      table: { select: { tableNumber: true, tableName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ serviceRequests });
}
