import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { createTableSchema } from "@/lib/validation";
import { generateQrToken } from "@/lib/qr-token";
import { checkPlanQuota } from "@/lib/services/subscription-guard.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// GET /api/admin/tables - Masaları listele
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    
    const tables = await prisma.table.findMany({
      where: { businessId, isDeleted: false },
      select: {
        id: true,
        tableNumber: true,
        tableName: true,
        status: true,
        isActive: true,
        qrToken: true,
        createdAt: true,
        orders: {
          where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        serviceRequests: {
          where: { status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
          select: {
            id: true,
            requestType: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        tableSessions: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            startedAt: true,
            bill: {
              select: {
                id: true,
                totalAmount: true,
                paidAmount: true,
                remainingAmount: true,
                paymentStatus: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { tableNumber: "asc" },
    });

    // Düzleştir
    const enriched = tables.map(t => ({
      ...t,
      activeSession: t.tableSessions[0] || null,
      bill: t.tableSessions[0]?.bill || null,
    }));

    return NextResponse.json({ tables: enriched });
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

  // 🔒 Plan Quota Enforcement
  const quotaCheck = await checkPlanQuota(businessId, "TABLE");
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      { error: quotaCheck.error || "Masa oluşturma paket limitine ulaşıldı." },
      { status: 403 }
    );
  }

  // Validation
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
    return NextResponse.json(
      { error: "Bu masa numarası zaten kullanılıyor" },
      { status: 400 }
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
