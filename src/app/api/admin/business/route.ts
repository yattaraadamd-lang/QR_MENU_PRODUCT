import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";

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
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, logo, address, phone, email } = body;

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(logo !== undefined && { logo }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
      },
    });

    return NextResponse.json({
      message: "İşletme güncellendi",
      business,
    });
  } catch (error) {
    console.error("İşletme güncelleme hatası:", error);

    return NextResponse.json(
      { error: "İşletme güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}