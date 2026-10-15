import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST kaldırıldı: müşteri talepleri /api/customer/service-requests üzerinden oluşturulur.

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
      where: { businessId },
      include: {
        table: true,
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
