import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    // ✅ GÜVENLIK: Auth zorunlu — sadece garson veya admin güncelleyebilir
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const params = await context.params;
    const { requestId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    // ✅ GÜVENLIK: Business izolasyonu — sadece kendi işletmesinin talebini güncelleyebilir
    const existing = await prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        businessId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Talep bulunamadı veya yetkiniz yok" },
        { status: 404 }
      );
    }

    const updateData: any = { status };
    if (status === RequestStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    const serviceRequest = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        table: true,
      },
    });

    return NextResponse.json({
      message: "Talep durumu güncellendi",
      serviceRequest,
    });
  } catch (error) {
    console.error("Talep güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Talep güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

