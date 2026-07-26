import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getClientIp, RateLimitPresets, createRateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // ⚠️ KULLANIM DIŞI ENDPOINT - Güvenlik nedeniyle devre dışı bırakıldı
  // Müşteri hizmet talepleri için /api/customer/service-requests kullanılmalı
  // Admin/Garson talepleri için authenticated endpoint'ler kullanılmalı
  
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
    // Bu endpoint artık korunmalı - sadece authenticated kullanıcılar erişebilir
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme ID gerekli" },
        { status: 400 }
      );
    }

    // Kullanıcının bu işletmeye erişim yetkisi var mı kontrol et
    if (session.user.role !== "SUPER_ADMIN") {
      const userBusinessId = session.user.businessId;
      if (userBusinessId !== businessId) {
        return NextResponse.json(
          { error: "Bu işletmenin taleplerine erişim yetkiniz yok" },
          { status: 403 }
        );
      }
    }

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
    console.error("Hizmet talepleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Talepler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
