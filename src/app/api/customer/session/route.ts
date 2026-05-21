import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// POST /api/customer/session - Masa oturumu oluştur (2 saatlik token)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId } = body;

    if (!businessId || !tableId) {
      return NextResponse.json(
        { error: "Geçersiz oturum bilgileri" },
        { status: 400 }
      );
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    // 2 saatlik session token oluştur
    const sessionToken = `session_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 saat

    // Masa'nın qrToken ve süresini güncelle
    await prisma.table.update({
      where: { id: tableId },
      data: {
        qrToken: sessionToken,
        qrTokenExpiresAt: expiresAt,
        status: table.status === "EMPTY" ? "OCCUPIED" : table.status,
      },
    });

    // ✅ Aktif TableSession yoksa oluştur + adisyon aç
    let tableSession = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
    });
    if (!tableSession) {
      tableSession = await prisma.tableSession.create({
        data: { businessId, tableId, status: "ACTIVE" },
      });
      await prisma.bill.create({
        data: {
          businessId,
          tableId,
          tableSessionId: tableSession.id,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: "UNPAID",
          status: "OPEN",
        },
      });
    }

    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      tableSessionId: tableSession.id,
      message: "Oturum oluşturuldu",
    });
  } catch (error) {
    console.error("Oturum oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Oturum oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// GET /api/customer/session?token=xxx&tableId=yyy - Token doğrula
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const tableId = searchParams.get("tableId");

    if (!token || !tableId) {
      return NextResponse.json(
        { valid: false, error: "Token ve masa ID gerekli" },
        { status: 400 }
      );
    }

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        qrToken: token,
        isActive: true,
      },
    });

    if (!table) {
      return NextResponse.json({ valid: false, error: "Geçersiz oturum" });
    }

    if (table.qrTokenExpiresAt && new Date() > table.qrTokenExpiresAt) {
      return NextResponse.json({ valid: false, error: "Oturum süresi doldu" });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Token doğrulama hatası:", error);
    return NextResponse.json(
      { valid: false, error: "Doğrulama hatası" },
      { status: 500 }
    );
  }
}
