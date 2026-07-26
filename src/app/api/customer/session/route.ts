import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/session
 *
 * Her cihaz için benzersiz VIEW_ONLY müşteri oturumu oluşturur.
 * Başka cihazın token'ını ASLA döndürmez.
 *
 * - İstemci kendi mevcut token'ını gönderirse (existingToken) yeniden kullanır.
 * - Geçerli QR ile gelen her yeni cihaz benzersiz VIEW_ONLY session alır.
 * - Token loglama YAPILMAZ.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, qrToken, existingToken } = body;

    if (!businessId || !tableId) {
      return NextResponse.json({ error: "Geçersiz oturum bilgileri" }, { status: 400 });
    }

    // ─── Masa kontrolü
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    // ─── Mevcut token yeniden kullanımı (aynı cihaz sayfa yenilerse)
    if (existingToken) {
      const existing = await prisma.customerSession.findUnique({
        where: { sessionToken: existingToken },
      });

      if (
        existing &&
        existing.tableId === tableId &&
        existing.businessId === businessId &&
        existing.status === "ACTIVE" &&
        existing.expiresAt > new Date()
      ) {
        // Aynı cihazın mevcut token'ı — yeniden kullan
        return NextResponse.json({
          sessionToken: existing.sessionToken,
          expiresAt: existing.expiresAt.toISOString(),
          authorizationStatus: existing.authorizationStatus,
          message: "Mevcut oturum kullanılıyor",
        });
      }
    }

    // ─── Yeni session oluşturmak için qrToken ZORUNLU
    if (!qrToken || qrToken !== table.qrToken) {
      return NextResponse.json({
        sessionToken: null,
        viewOnly: true,
        message: "Sipariş vermek için QR kodu tekrar okutun.",
      });
    }

    // ─── Benzersiz VIEW_ONLY CustomerSession oluştur (2 saatlik)
    const sessionToken = `cs_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await prisma.customerSession.create({
      data: {
        businessId,
        tableId,
        sessionToken,
        status: "ACTIVE",
        authorizationStatus: "VIEW_ONLY",
        expiresAt,
      },
    });

    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      authorizationStatus: "VIEW_ONLY",
      message: "Menü görüntüleme oturumu oluşturuldu",
    });
  } catch (error) {
    console.error("Oturum oluşturma hatası:", error);
    return NextResponse.json({ error: "Oturum oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}

/**
 * GET /api/customer/session?token=xxx — Token doğrula + yetki durumu döndür
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token gerekli" },
        { status: 400 }
      );
    }

    const session = await prisma.customerSession.findUnique({
      where: { sessionToken: token },
    });

    if (!session) {
      return NextResponse.json({ valid: false, error: "Geçersiz oturum" });
    }

    if (session.status === "REVOKED") {
      return NextResponse.json({
        valid: false,
        authorizationStatus: "REVOKED",
        error: "Bu oturum iptal edilmiş.",
        code: "SESSION_REVOKED",
      });
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json({ valid: false, error: "Oturum aktif değil" });
    }

    if (new Date() > session.expiresAt) {
      await prisma.customerSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ valid: false, error: "Oturum süresi doldu" });
    }

    return NextResponse.json({
      valid: true,
      authorizationStatus: session.authorizationStatus,
      tableSessionId: session.tableSessionId,
    });
  } catch (error) {
    console.error("Token doğrulama hatası:", error);
    return NextResponse.json(
      { valid: false, error: "Doğrulama hatası" },
      { status: 500 }
    );
  }
}
