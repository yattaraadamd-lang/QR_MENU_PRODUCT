import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { rateLimit, getClientIp, RateLimitPresets, createRateLimitResponse } from "@/lib/rate-limit";

// QR kod okutulduğunda masa oturumu oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    // Rate limiting - QR kod okutma
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimit({
      ...RateLimitPresets.CUSTOMER_SESSION,
      identifier: `session_${clientIp}`,
    });

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const { tableId } = params;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Masa bulunamadı" },
        { status: 404 }
      );
    }

    if (!table.isActive) {
      return NextResponse.json(
        { error: "Bu masa şu anda aktif değil" },
        { status: 400 }
      );
    }

    // Yeni token oluştur (4 saat geçerli)
    const qrToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    // Masa oturumunu güncelle
    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: {
        qrToken,
        qrTokenExpiresAt: expiresAt,
        status: "OCCUPIED",
      },
    });

    return NextResponse.json({
      message: "Oturum oluşturuldu",
      qrToken,
      expiresAt,
      table: {
        id: updatedTable.id,
        tableNumber: updatedTable.tableNumber,
        tableName: updatedTable.tableName,
      },
    });
  } catch (error) {
    console.error("Oturum oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Oturum oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// Oturum doğrulama
export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params;
    const { searchParams } = new URL(request.url);
    const qrToken = searchParams.get("token");

    if (!qrToken) {
      return NextResponse.json(
        { error: "Token gerekli", valid: false },
        { status: 400 }
      );
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Masa bulunamadı", valid: false },
        { status: 404 }
      );
    }

    // Token kontrolü
    if (table.qrToken !== qrToken) {
      return NextResponse.json(
        { error: "Geçersiz token", valid: false },
        { status: 403 }
      );
    }

    // Süre kontrolü
    if (table.qrTokenExpiresAt && new Date() > table.qrTokenExpiresAt) {
      return NextResponse.json(
        { error: "Oturum süresi doldu", valid: false },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        status: table.status,
      },
    });
  } catch (error) {
    console.error("Oturum doğrulama hatası:", error);
    return NextResponse.json(
      { error: "Oturum doğrulanırken bir hata oluştu", valid: false },
      { status: 500 }
    );
  }
}
