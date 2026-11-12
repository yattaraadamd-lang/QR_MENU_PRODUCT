import { NextRequest, NextResponse } from "next/server";
import type { TableListResponse } from "@/contracts/tables";
import { TABLE_LIST_SELECT, toTableDTO } from "@/lib/api/tables.dto";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { createTableSchema } from "@/lib/validation";
import { generateQrToken } from "@/lib/qr-token";
import { checkPlanQuota } from "@/lib/services/subscription-guard.service";
import { ApiError, withApiHandler, parseJson } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// GET /api/admin/tables - Masaları listele
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // Garson listesiyle aynı sözleşme; QR kodu ekrana generate-qr ucundan gelir
    const tables = await prisma.table.findMany({
      where: { businessId, isDeleted: false },
      select: TABLE_LIST_SELECT,
      orderBy: { tableNumber: "asc" },
    });

    return NextResponse.json({ tables: tables.map(toTableDTO) } satisfies TableListResponse);
  } catch (error) {
    console.error("Masa listeleme hatası:", error);
    return NextResponse.json(
      { error: "Masalar yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST /api/admin/tables - Masa oluştur
export const POST = withApiHandler("POST /api/admin/tables", handlePost);

async function handlePost(request: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const businessId = getBusinessIdFromSession(authResult.session);

  // Önce girdinin kendisi (biçim, sonra numara çakışması), ardından paket kotası: form hatası
  // alanın altında görünür, kota hatası formun geneline aittir
  const { tableNumber, tableName } = await parseJson(request, createTableSchema);

  // Aynı numarada masa var mı kontrol et (tenant-safe)
  const existing = await prisma.table.findFirst({
    where: {
      businessId,
      tableNumber: tableNumber.toString(),
      isDeleted: false,
    },
    select: { id: true },
  });

  if (existing) {
    const message = "Bu masa numarası zaten kullanılıyor";
    throw new ApiError(400, "TABLE_NUMBER_TAKEN", message, { tableNumber: message });
  }

  // 🔒 Plan Quota Enforcement
  const quotaCheck = await checkPlanQuota(businessId, "TABLE");
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      { error: quotaCheck.error || "Masa oluşturma paket limitine ulaşıldı." },
      { status: 403 }
    );
  }

  const qrToken = generateQrToken();

  const table = await prisma.table.create({
    data: {
      businessId,
      tableNumber: tableNumber.toString(),
      tableName: tableName || `Masa ${tableNumber}`,
      qrToken,
    },
    select: {
      id: true,
      tableNumber: true,
      tableName: true,
      status: true,
      isActive: true,
      qrToken: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    { message: "Masa oluşturuldu", table },
    { status: 201 }
  );
}
