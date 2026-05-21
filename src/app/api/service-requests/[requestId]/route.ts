import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
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
