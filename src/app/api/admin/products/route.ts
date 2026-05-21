import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, validateQuery, createProductSchema, updateProductSchema, productFilterSchema } from "@/lib/validation";

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
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    const body = await request.json();

    // Validation
    const validation = validateBody(createProductSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

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
  } catch (error) {
    console.error("Ürün oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Ürün oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
