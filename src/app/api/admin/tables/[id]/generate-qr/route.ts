import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { generateQrToken } from "@/lib/qr-token";
import { withApiHandler } from "@/lib/api/handler";
import { renderTableQr } from "@/lib/services/table-qr.service";

// POST /api/admin/tables/[id]/generate-qr - QR kod oluştur
export const POST = withApiHandler("POST /api/admin/tables/[id]/generate-qr", handlePost);

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  
  const { error, response, session } = await requireAdmin();
  if (error) return response!;

  const businessId = getBusinessId(session);

  const table = await prisma.table.findFirst({
    where: { id: params.id, businessId },
    include: {
      business: {
        select: { slug: true },
      },
    },
  });

  if (!table) {
    return NextResponse.json(
      { error: "Masa bulunamadı" },
      { status: 404 }
    );
  }

  // ✅ qrToken null ise yeni kalıcı token oluştur ve kaydet
  let qrToken = table.qrToken;
  if (!qrToken) {
    qrToken = generateQrToken();
    await prisma.table.update({
      where: { id: params.id },
      data: { qrToken },
    });
  }

  return NextResponse.json({
    message: "QR kod oluşturuldu",
    ...(await renderTableQr(qrToken)),
    qrToken,
    tableId: table.id,
    tableNumber: table.tableNumber,
    tableName: table.tableName,
  });
}

