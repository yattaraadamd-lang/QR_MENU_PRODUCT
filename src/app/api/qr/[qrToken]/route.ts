import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/qr/[qrToken] - QR token ile işletme ve masa bilgisi getir
// ✅ Masa durumunu DEĞİŞTİRMEZ — sadece bilgi döndürür
export async function GET(
  request: NextRequest,
  { params }: { params: { qrToken: string } }
) {
  try {
    const table = await prisma.table.findFirst({
      where: { qrToken: params.qrToken, isDeleted: false },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logo: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    if (!table.business.isActive) {
      return NextResponse.json(
        { error: "Bu işletme şu anda aktif değil" },
        { status: 403 }
      );
    }

    // ✅ Masa durumu değiştirilmiyor — sadece bilgi döndürülüyor
    return NextResponse.json({
      business: table.business,
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        status: table.status,
      },
    });
  } catch (error) {
    console.error("QR token doğrulama hatası:", error);
    return NextResponse.json(
      { error: "QR kod doğrulanırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
