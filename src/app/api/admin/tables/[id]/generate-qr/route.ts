import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import QRCode from "qrcode";

// POST /api/admin/tables/[id]/generate-qr - QR kod oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    const table = await prisma.table.findFirst({
      where: { id: params.id, businessId },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Masa bulunamadı" },
        { status: 404 }
      );
    }

    if (!table.qrToken) {
      return NextResponse.json(
        { error: "Masa için QR token bulunamadı" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrUrl = `${appUrl}/qr/${table.qrToken}`;

    // QR kod görselini oluştur (base64 data URL)
    const qrImageData = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return NextResponse.json({
      message: "QR kod oluşturuldu",
      qrUrl,
      qrToken: table.qrToken,
      qrImageData,
      tableNumber: table.tableNumber,
      tableName: table.tableName,
    });
  } catch (error) {
    console.error("QR kod oluşturma hatası:", error);
    return NextResponse.json(
      { error: "QR kod oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
