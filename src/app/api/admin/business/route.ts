import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { updateBusinessSchema } from "@/lib/validation";
import { withApiHandler, parseJson } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/business - İşletme bilgilerini getir
export async function GET() {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme ID bulunamadı" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
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

// PUT /api/admin/business - İşletme bilgilerini güncelle
export const PUT = withApiHandler("PUT /api/admin/business", handlePut);

async function handlePut(request: NextRequest) {
  const { error, response, session } = await requireAdmin();
  if (error) return response!;

  const businessId = getBusinessId(session);

  if (!businessId) {
    return NextResponse.json(
      { error: "İşletme ID bulunamadı" },
      { status: 400 }
    );
  }

  // ✅ SECURITY: Tip/uzunluk doğrulaması; bilinmeyen alanlar (ör. isActive) atılır
  const { email, logo, ...rest } = await parseJson(request, updateBusinessSchema);

  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      ...rest,
      ...(email !== undefined && { email: email || null }),
      ...(logo !== undefined && { logo: logo || null }),
    },
  });

  return NextResponse.json({
    message: "İşletme güncellendi",
    business,
  });
}