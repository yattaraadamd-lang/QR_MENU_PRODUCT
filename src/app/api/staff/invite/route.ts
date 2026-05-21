import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, inviteCode } = body;

    if (!businessId || !inviteCode) {
      return NextResponse.json(
        { error: "İşletme ID ve davet kodu gerekli" },
        { status: 400 }
      );
    }

    // Davet kodu oluştur
    const invite = await prisma.waiterInvite.create({
      data: {
        businessId,
        inviteCode,
        isUsed: false,
      },
    });

    return NextResponse.json(
      {
        message: "Davet kodu oluşturuldu",
        invite,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Davet kodu oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Davet kodu oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
