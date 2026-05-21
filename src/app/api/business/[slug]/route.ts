import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


// GET /api/business/[slug] - Public: İşletme bilgilerini getir
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { slug: params.slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        address: true,
        phone: true,
        email: true,
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
