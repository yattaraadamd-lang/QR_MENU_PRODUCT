import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getClientIp, RateLimitPresets, createRateLimitResponse } from "@/lib/rate-limit";
import { verifyQRSession } from "@/lib/tenant";
import { validateBody, createOrderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - Sipariş oluşturma
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimit({
      ...RateLimitPresets.ORDER_CREATION,
      identifier: `order_${clientIp}`,
    });

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validation
    const validation = validateBody(createOrderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { tableId, items, note } = validation.data;

    // QR token kontrolü
    const qrToken = request.headers.get("x-qr-token");
    if (!qrToken) {
      return NextResponse.json(
        { error: "Geçersiz oturum. Lütfen QR kodu tekrar okutun." },
        { status: 403 }
      );
    }

    const sessionResult = await verifyQRSession(tableId, qrToken);
    if (!sessionResult.success) {
      return sessionResult.response;
    }

    const { table } = sessionResult;
    const businessId = table.businessId;

    // Transaction içinde tüm işlemleri yap
    const result = await prisma.$transaction(async (tx) => {
      // 1. Masa kontrolü (transaction içinde tekrar kontrol)
      const tableCheck = await tx.table.findUnique({
        where: { id: tableId },
        select: {
          id: true,
          businessId: true,
          tableNumber: true,
          tableName: true,
          isActive: true,
          qrToken: true,
          qrTokenExpiresAt: true,
        },
      });

      if (!tableCheck || !tableCheck.isActive) {
        throw new Error("Masa aktif değil");
      }

      if (tableCheck.qrToken !== qrToken) {
        throw new Error("Geçersiz oturum");
      }

      if (tableCheck.qrTokenExpiresAt && new Date() > tableCheck.qrTokenExpiresAt) {
        throw new Error("Oturum süresi doldu");
      }

      // 2. Ürünleri doğrula ve fiyatları hesapla
      let totalPrice = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            businessId, // Tenant check
            isDeleted: false,
          },
          select: {
            id: true,
            name: true,
            price: true,
            isAvailable: true,
            stockStatus: true,
          },
        });

        if (!product) {
          throw new Error(`Ürün bulunamadı: ${item.productId}`);
        }

        // Stok kontrolü
        if (!product.isAvailable || product.stockStatus !== "IN_STOCK") {
          throw new Error(`${product.name} şu anda stokta yok`);
        }

        const itemTotal = Number(product.price) * item.quantity;
        totalPrice += itemTotal;

        orderItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal,
          customerNote: item.customerNote || null,
        });
      }

      // 3. Sipariş oluştur
      const order = await tx.order.create({
        data: {
          businessId,
          tableId,
          totalPrice,
          note: note || null,
          status: OrderStatus.PENDING,
          items: {
            create: orderItems,
          },
        },
        select: {
          id: true,
          totalPrice: true,
          status: true,
          note: true,
          createdAt: true,
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
        },
      });

      // 4. Masa durumunu güncelle
      await tx.table.update({
        where: { id: tableId },
        data: { status: TableStatus.HAS_ORDER },
      });

      // 5. Bildirim oluştur
      await tx.notification.create({
        data: {
          businessId,
          tableId,
          type: "NEW_ORDER",
          title: "Yeni Sipariş",
          message: `Masa ${tableCheck.tableNumber} yeni sipariş verdi`,
          soundType: "ORDER",
        },
      });

      return {
        order,
        table: {
          tableNumber: tableCheck.tableNumber,
          tableName: tableCheck.tableName,
        },
      };
    });

    return NextResponse.json(
      {
        message: "Sipariş başarıyla oluşturuldu",
        order: result.order,
        table: result.table,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Sipariş oluşturma hatası:", error);
    
    // Transaction error'larını kullanıcıya ilet
    if (error.message && (
      error.message.includes("Masa") ||
      error.message.includes("Ürün") ||
      error.message.includes("stokta") ||
      error.message.includes("oturum")
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Sipariş oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Bu endpoint artık korunmalı - sadece authenticated kullanıcılar erişebilir
    // Waiter veya Admin rolü gerekli
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    // BusinessId session'dan al - ASLA query string'den alma!
    const businessId = session.user.businessId;

    // Super admin tüm işletmelere erişebilir
    if (session.user.role === "SUPER_ADMIN") {
      const { searchParams } = new URL(request.url);
      const requestedBusinessId = searchParams.get("businessId");
      
      if (requestedBusinessId) {
        // Super admin specific business query
        const orders = await prisma.order.findMany({
          where: { businessId: requestedBusinessId },
          select: {
            id: true,
            totalPrice: true,
            status: true,
            paymentStatus: true,
            note: true,
            createdAt: true,
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
          },
          orderBy: { createdAt: "desc" },
          take: 100, // Limit results
        });

        return NextResponse.json({ orders });
      }
    }

    // Normal admin/waiter - sadece kendi işletmesi
    const orders = await prisma.order.findMany({
      where: { businessId },
      select: {
        id: true,
        totalPrice: true,
        status: true,
        paymentStatus: true,
        note: true,
        createdAt: true,
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
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit results
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Sipariş listeleme hatası:", error);
    return NextResponse.json(
      { error: "Siparişler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
