import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


// GET /api/business/[slug] - Public: İşletme bilgilerini getir
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    
    const business = await prisma.business.findUnique({
      where: { slug: params.slug, isActive: true },
      // Kimliksiz uç: e-posta ve telefon kayıtta işletme sahibinin giriş bilgisiyle aynı olabilir
      select: {
        name: true,
        slug: true,
        description: true,
        logo: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "İşletme bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("İşletme getirme hatası:", error);
    return NextResponse.json(
      { error: "İşletme bilgileri yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
