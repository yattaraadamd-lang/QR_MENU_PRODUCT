import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { validateQuery, orderFilterSchema, paginationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/waiter/orders - Garson siparişleri listele
export async function GET(request: NextRequest) {
  try {
    // ✅ Authentication (Waiter or Admin)
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    // ✅ Verify role
    if (!["WAITER", "ADMIN", "SUPER_ADMIN"].includes(authResult.session.role)) {
      return NextResponse.json(
        { error: "Bu işlem için garson veya admin yetkisi gereklidir" },
        { status: 403 }
      );
    }

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Guard: businessId must exist
    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme bilgisi bulunamadı. Lütfen tekrar giriş yapın." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Build where clause
    const where: any = { businessId };

    // ✅ Handle legacy "status" param first (active/completed) — frontend uses these
    const legacyStatus = searchParams.get("status");
    if (legacyStatus === "active") {
      where.status = { in: ["PENDING", "ACCEPTED", "PREPARING"] };
    } else if (legacyStatus === "completed") {
      where.status = { in: ["SERVED", "CANCELLED"] };
    } else {
      // Only validate with Zod schema if not using legacy status values
      const filterValidation = validateQuery(orderFilterSchema, searchParams);
      if (filterValidation.success) {
        if (filterValidation.data.status) {
          where.status = filterValidation.data.status;
        }
        if (filterValidation.data.tableId) {
          where.tableId = filterValidation.data.tableId;
        }
        if (filterValidation.data.startDate) {
          where.createdAt = { ...where.createdAt, gte: filterValidation.data.startDate };
        }
        if (filterValidation.data.endDate) {
          where.createdAt = { ...where.createdAt, lte: filterValidation.data.endDate };
        }
      }
    }

    // Apply non-status filters from query (tableId, dates) even for legacy status
    if (legacyStatus === "active" || legacyStatus === "completed") {
      const tableId = searchParams.get("tableId");
      if (tableId) {
        where.tableId = tableId;
      }
    }

    // ✅ Pagination — safe defaults
    const paginationValidation = validateQuery(paginationSchema, searchParams);
    const page = paginationValidation.success ? (paginationValidation.data.page ?? 1) : 1;
    const limit = paginationValidation.success ? (paginationValidation.data.limit ?? 20) : 20;
    const skip = (page - 1) * limit;

    // ✅ Tenant-safe query with minimal select
    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        totalPrice: true,
        status: true,
        note: true,
        createdAt: true,
        cancelReason: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            customerNote: true,
          },
        },
        table: {
          select: {
            id: true,
            tableNumber: true,
            tableName: true,
          },
        },
        waiter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json({ orders, page, limit });
  } catch (error) {
    console.error("Sipariş listeleme hatası:", error instanceof Error ? error.message : error);
    console.error("Stack:", error instanceof Error ? error.stack : "N/A");
    return NextResponse.json(
      { error: "Siparişler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
