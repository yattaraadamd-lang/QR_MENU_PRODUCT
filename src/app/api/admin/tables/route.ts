import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, createTableSchema } from "@/lib/validation";
import { v4 as uuidv4 } from "uuid";

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
          take: 1,
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
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    const body = await request.json();

    // Validation
    const validation = validateBody(createTableSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { tableNumber, tableName } = validation.data;

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

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });
    
    const qrToken = `qr_${business?.slug || businessId}_${tableNumber}_${uuidv4().slice(0, 8)}`;

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
  } catch (error) {
    console.error("Masa oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Masa oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
