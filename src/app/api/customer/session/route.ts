import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/session
 *
 * ✅ DÜZELTME: QR okutulduğunda SADECE görüntüleme token'ı verilir.
 * 
 * YANLIŞTI:
 * - QR okutulunca TableSession + Bill oluşturuluyordu
 * - Masa OCCUPIED yapılıyordu
 * - Müşteri menüye bakıp çıksa bile masa dolu kalıyordu
 * 
 * DOĞRU AKIŞ:
 * 1. Masa ve işletme doğrulanır
 * 2. CustomerSession oluşturulur (sadece görüntüleme için)
 * 3. TableSession VE Bill OLUŞTURULMAZ
 * 4. Masa durumu DEĞİŞTİRİLMEZ
 * 5. İlk sipariş verildiğinde TableSession + Bill oluşturulur (/api/customer/orders)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, qrToken } = body;

    if (!businessId || !tableId) {
      return NextResponse.json({ error: "Geçersiz oturum bilgileri" }, { status: 400 });
    }

    // ─── Masa kontrolü ────────────────────────────────────────────────
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    // ─── Var olan CustomerSession kontrol et ──────────────────────────
    // (aynı cihazdan sayfa yenilenirse mevcut token yeniden kullanılır)
    const existingCustomerSession = await prisma.customerSession.findFirst({
      where: {
        tableId,
        businessId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingCustomerSession) {
      // ✅ Mevcut token döndür — masa durumu değiştirilmez
      return NextResponse.json({
        sessionToken: existingCustomerSession.sessionToken,
        expiresAt: existingCustomerSession.expiresAt.toISOString(),
        message: "Mevcut oturum kullanılıyor",
      });
    }

    // ─── Yeni session oluşturmak için qrToken ZORUNLU ─────────────────
    // Sayfa yenileme ile (qrToken olmadan) yeni session açılamaz
    if (!qrToken || qrToken !== table.qrToken) {
      return NextResponse.json({
        sessionToken: null,
        viewOnly: true,
        message: "Sipariş vermek için QR kodu tekrar okutun.",
      });
    }

    // ─── CustomerSession oluştur (2 saatlik) ──────────────────────────
    // ✅ SADECE görüntüleme token'ı oluştur — TableSession/Bill oluşturma
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

    console.log(`[SESSION] View-only session created tableId=${tableId} — NO TableSession/Bill created`);

    // ✅ Masa durumu DEĞİŞTİRİLMEZ — sadece token döndür
    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      message: "Menü görüntüleme oturumu oluşturuldu",
    });
  } catch (error) {
    console.error("Oturum oluşturma hatası:", error);
    return NextResponse.json({ error: "Oturum oluşturulurken bir hata oluştu" }, { status: 500 });
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
