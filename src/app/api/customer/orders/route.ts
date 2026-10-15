import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// ✅ Oturum token kontrolü — CustomerSession tablosundan doğrula
async function validateSessionToken(
  request: NextRequest,
  tableId: string
): Promise<{ valid: boolean; error?: string; sessionId?: string }> {
  const sessionToken = request.headers.get("x-session-token");
  if (!sessionToken) {
    return { valid: false, error: "Oturum token'ı gerekli. Lütfen QR kodu tekrar okutun." };
  }

  const customerSession = await prisma.customerSession.findFirst({
    where: { sessionToken, tableId, status: "ACTIVE" },
  });

  if (!customerSession) {
    return { valid: false, error: "Bu masa oturumu kapatılmış veya geçersiz. Lütfen QR kodu tekrar okutun." };
  }

  if (new Date() > customerSession.expiresAt) {
    await prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { status: "EXPIRED" },
    });
    return { valid: false, error: "Oturum süresi doldu. Lütfen QR kodu tekrar okutun." };
  }

  return { valid: true, sessionId: customerSession.id };
}

// POST /api/customer/orders
// ✅ Sipariş PENDING olarak oluşturulur — garson onayına düşer
// ✅ TableSession ve Bill GARSON KABUL EDİNCE oluşturulur
// ✅ Masa durumu sipariş verilince değişmez — garson kabul edince değişir
// ✅ Konum kontrolü tamamen kaldırıldı
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, items, note } = body;

    if (!businessId || !tableId || !items || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sipariş bilgileri" }, { status: 400 });
    }

    // ✅ Session token kontrolü
    const tokenValidation = await validateSessionToken(request, tableId);
    if (!tokenValidation.valid) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 401 });
    }

    // Masa ve işletme kontrolü
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
      include: { business: true },
    });

    if (!table || !table.business) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    if (!table.business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // Ürün kontrolleri
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, businessId, isDeleted: false },
      });

      if (!product) {
        return NextResponse.json({ error: `Ürün bulunamadı: ${item.productId}` }, { status: 404 });
      }
      if (!product.isAvailable) {
        return NextResponse.json({ error: `"${product.name}" şu anda mevcut değil.` }, { status: 400 });
      }
      if (product.stockStatus !== "IN_STOCK") {
        return NextResponse.json({ error: `"${product.name}" şu anda stokta yok.` }, { status: 400 });
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

    // ✅ Sipariş PENDING olarak oluştur — tableSessionId YOK (garson kabul edince atanacak)
    // ✅ Masa durumu DEĞİŞTİRİLMEZ
    // ✅ TableSession/Bill OLUŞTURULMAZ
    const order = await prisma.order.create({
      data: {
        businessId,
        tableId,
        tableSessionId: null,
        totalPrice,
        note: note || null,
        status: OrderStatus.PENDING,
        paymentStatus: "UNPAID",
        items: { create: orderItems },
      },
      include: {
        items: { include: { product: true } },
        table: true,
      },
    });

    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        businessId,
        tableId,
        type: "NEW_ORDER",
        title: "Yeni Sipariş — Onay Bekliyor",
        message: `${table.tableName || "Masa " + table.tableNumber} yeni sipariş verdi (garson onayı gerekli)`,
        soundType: "ORDER",
      },
    });

    // Socket.IO bildirimi
    try {
      emitToBusinessRoom(businessId, "new_order", {
        orderId: order.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        message: `${table.tableName || "Masa " + table.tableNumber} yeni sipariş verdi`,
        soundType: "new_order",
        totalPrice: Number(order.totalPrice),
        itemCount: order.items.length,
        createdAt: order.createdAt,
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json(
      {
        message: "Sipariş iletildi. Garson onayı bekleniyor.",
        order,
        pendingApproval: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sipariş oluşturma hatası:", error);
    return NextResponse.json({ error: "Sipariş oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
