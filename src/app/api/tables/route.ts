import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme ID gerekli" },
        { status: 400 }
      );
    }

    const tables = await prisma.table.findMany({
      where: { businessId },
      orderBy: { tableNumber: "asc" },
      include: {
        orders: {
          where: {
            status: {
              in: ["PENDING", "ACCEPTED", "PREPARING"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        serviceRequests: {
          where: {
            status: {
              in: ["PENDING", "IN_PROGRESS"],
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Masa listeleme hatası:", error);
    return NextResponse.json(
      { error: "Masalar yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
