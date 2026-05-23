import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// POST /api/customer/session - Müşteri oturumu oluştur (CustomerSession tablosunda)
// ✅ Table.qrToken DEĞİŞTİRİLMEZ — kalıcı QR kimliği korunur
// ✅ Masa durumu DEĞİŞTİRİLMEZ — sadece sipariş verilince değişir
// ✅ TableSession / Bill OLUŞTURULMAZ — sadece sipariş verilince oluşturulur
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

    // Aktif CustomerSession var mı kontrol et
    const existingSession = await prisma.customerSession.findFirst({
      where: {
        tableId,
        businessId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingSession) {
      // Mevcut aktif session'ı döndür
      return NextResponse.json({
        sessionToken: existingSession.sessionToken,
        expiresAt: existingSession.expiresAt.toISOString(),
        message: "Mevcut oturum kullanılıyor",
      });
    }

    // Yeni CustomerSession oluştur (2 saatlik)
    const sessionToken = `cs_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 saat

    await prisma.customerSession.create({
      data: {
        businessId,
        tableId,
        sessionToken,
        status: "ACTIVE",
        expiresAt,
      },
    });

    // ✅ Table.qrToken dokunulmadı
    // ✅ Masa durumu değiştirilmedi
    // ✅ TableSession / Bill oluşturulmadı

    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
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

    // ✅ CustomerSession tablosundan doğrula
    const session = await prisma.customerSession.findFirst({
      where: {
        sessionToken: token,
        tableId,
        status: "ACTIVE",
      },
    });

    if (!session) {
      return NextResponse.json({ valid: false, error: "Geçersiz oturum" });
    }

    if (new Date() > session.expiresAt) {
      // Süresi dolmuş session'ı EXPIRED yap
      await prisma.customerSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
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

