import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TableStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    const table = await prisma.table.update({
      where: { id: tableId },
      data: { status },
    });

    return NextResponse.json({
      message: "Masa durumu güncellendi",
      table,
    });
  } catch (error) {
    console.error("Masa güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Masa güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
