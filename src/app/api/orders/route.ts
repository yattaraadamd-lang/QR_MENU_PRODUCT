import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST kaldırıldı: müşteri siparişleri /api/customer/orders üzerinden (CustomerSession doğrulamalı) oluşturulur.

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
