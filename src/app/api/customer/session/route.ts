import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// ✅ Oturum süresi: 90 dakika
const SESSION_DURATION_MS = 90 * 60 * 1000;

/**
 * POST /api/customer/session
 *
 * QR okutulduğunda çağrılır. Yeni akış:
 * 1. Masa ve işletme doğrulanır.
 * 2. ACTIVE TableSession var mı kontrol edilir.
 *    - Var ve 90 dk geçmemiş → mevcut session kullanılır.
 *    - Var ama 90 dk geçmiş    → CLOSED yapılır, yeni oluşturulur.
 *    - Hiç yok                 → yeni TableSession + Bill oluşturulur.
 * 3. CustomerSession oluşturulur (token verilir).
 *
 * ✅ "Masayı Aç" garson butonu kaldırıldı — TableSession burada otomatik kurulur.
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
      // Bu customer session'ın bağlı olduğu TableSession hâlâ aktif mi?
      const ts = await prisma.tableSession.findFirst({
        where: { tableId, businessId, status: "ACTIVE" },
        select: { id: true, startedAt: true },
      });

      if (ts) {
        const isExpired = Date.now() - ts.startedAt.getTime() > SESSION_DURATION_MS;
        if (!isExpired) {
          // ✅ Her iki session da geçerli — mevcut token döndür
          return NextResponse.json({
            sessionToken: existingCustomerSession.sessionToken,
            expiresAt: existingCustomerSession.expiresAt.toISOString(),
            message: "Mevcut oturum kullanılıyor",
          });
        }
        // TableSession süresi geçmiş — kapat, yeni oluşturulacak
        await prisma.tableSession.update({
          where: { id: ts.id },
          data: { status: "CLOSED", endedAt: new Date() },
        });
      }

      // CustomerSession'ı da kapat
      await prisma.customerSession.update({
        where: { id: existingCustomerSession.id },
        data: { status: "CLOSED" },
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

    // ─── Aktif TableSession bul ya da oluştur ─────────────────────────
    let tableSessionId: string;

    const activeTs = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      select: { id: true, startedAt: true },
    });

    if (activeTs && Date.now() - activeTs.startedAt.getTime() <= SESSION_DURATION_MS) {
      // ✅ Geçerli oturum var — kullan (madde 11)
      tableSessionId = activeTs.id;
    } else {
      // Süresi geçmiş varsa kapat
      if (activeTs) {
        await prisma.tableSession.update({
          where: { id: activeTs.id },
          data: { status: "CLOSED", endedAt: new Date() },
        });
        // İlgili CustomerSession'ları da kapat
        await prisma.customerSession.updateMany({
          where: { tableId, businessId, status: "ACTIVE" },
          data: { status: "CLOSED" },
        });
      }

      // ✅ Yeni TableSession + Bill oluştur (transaction)
      const result = await prisma.$transaction(async (tx) => {
        const newTs = await tx.tableSession.create({
          data: { businessId, tableId, status: "ACTIVE" },
        });
        await tx.bill.create({
          data: {
            businessId,
            tableId,
            tableSessionId: newTs.id,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paymentStatus: "UNPAID",
            status: "OPEN",
          },
        });
        // Masa durumunu OCCUPIED yap
        await tx.table.update({
          where: { id: tableId },
          data: { status: "OCCUPIED" },
        });
        return newTs;
      });

      tableSessionId = result.id;
    }

    // ─── CustomerSession oluştur (2 saatlik) ──────────────────────────
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

    console.log(`[SESSION] New session created tableId=${tableId} tsId=${tableSessionId}`);

    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      message: "Oturum oluşturuldu",
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
