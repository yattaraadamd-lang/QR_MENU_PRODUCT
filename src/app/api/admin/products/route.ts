import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateQuery, createProductSchema, updateProductSchema, productFilterSchema } from "@/lib/validation";
import { checkPlanQuota } from "@/lib/services/subscription-guard.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// GET /api/admin/products - Ürünleri listele
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    
    // Query parameters validation
    const { searchParams } = new URL(request.url);
    const filterValidation = validateQuery(productFilterSchema, searchParams);
    
    const where: any = {
      businessId,
      isDeleted: false,
    };

    // Apply filters if valid
    if (filterValidation.success) {
      const { categoryId, isAvailable, stockStatus, search } = filterValidation.data;
      
      if (categoryId) where.categoryId = categoryId;
      if (isAvailable !== undefined) where.isAvailable = isAvailable;
      if (stockStatus) where.stockStatus = stockStatus;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        isAvailable: true,
        stockStatus: true,
        isPopular: true,
        sortOrder: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { sortOrder: "asc" },
      ],
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Ürün listeleme hatası:", error);
    return NextResponse.json(
      { error: "Ürünler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST /api/admin/products - Ürün oluştur
export const POST = withApiHandler("POST /api/admin/products", handlePost);

async function handlePost(request: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const businessId = getBusinessIdFromSession(authResult.session);

  // 🔒 Plan Quota Enforcement
  const quotaCheck = await checkPlanQuota(businessId, "PRODUCT");
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      { error: quotaCheck.error || "Ürün oluşturma paket limitine ulaşıldı." },
      { status: 403 }
    );
  }

  // Validation
  const input = await parseJson(request, createProductSchema);

  const data = input;

  // CategoryId ownership check
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: data.categoryId,
        businessId, // Tenant check
      },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori bulunamadı veya size ait değil" },
        { status: 404 }
      );
    }
  }

  const product = await prisma.product.create({
    data: {
      businessId,
      ...data,
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      image: true,
      isAvailable: true,
      stockStatus: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
    },
  });

  return NextResponse.json(
    { message: "Ürün oluşturuldu", product },
    { status: 201 }
  );
}
