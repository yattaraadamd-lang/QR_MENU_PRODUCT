import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { getDistanceFromLatLonInMeters } from "@/lib/location-helpers";

export const dynamic = "force-dynamic";

// ✅ Oturum token kontrolü — CustomerSession tablosundan doğrula
async function validateSessionToken(
  request: NextRequest,
  tableId: string
): Promise<{ valid: boolean; error?: string }> {
  const sessionToken = request.headers.get("x-session-token");
  if (!sessionToken) {
    return { valid: false, error: "Oturum token'ı gerekli. Lütfen QR kodu tekrar okutun." };
  }

  // ✅ CustomerSession tablosundan doğrula — Table.qrToken kullanılmıyor
  const customerSession = await prisma.customerSession.findFirst({
    where: {
      sessionToken,
      tableId,
      status: "ACTIVE",
    },
  });

  if (!customerSession) {
    return { valid: false, error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." };
  }

  if (new Date() > customerSession.expiresAt) {
    await prisma.customerSession.update({
      where: { id: customerSession.id },
      data: { status: "EXPIRED" },
    });
    return { valid: false, error: "Oturum süresi doldu. Lütfen QR kodu tekrar okutun." };
  }

  return { valid: true };
}

// POST /api/customer/orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, items, note, customerLat, customerLng } = body;

    if (!businessId || !tableId || !items || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sipariş bilgileri" }, { status: 400 });
    }

    // Session token kontrolü
    const tokenValidation = await validateSessionToken(request, tableId);
    if (!tokenValidation.valid) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 401 });
    }

    // Masa ve işletme kontrolü — silinen masa engellenir
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

    const business = table.business;

    // İşletme aktif mi?
    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ✅ Konum kontrolü - OPSIYONEL (sadece log, sipariş engellenmez)
    // Asıl güvenlik: CustomerSession (aktif mi?) + TableSession (masa kapatılmış mı?)
    if (customerLat && customerLng && business.latitude && business.longitude && business.allowedRadiusMeters) {
      const distance = getDistanceFromLatLonInMeters(
        business.latitude, business.longitude, customerLat, customerLng
      );
      if (distance > business.allowedRadiusMeters) {
        console.log(`⚠️ Sipariş restoran dışından verildi. Masa: ${table.tableNumber}, Mesafe: ${Math.round(distance)}m / İzin verilen: ${business.allowedRadiusMeters}m`);
      }
    }

    // Ürün kontrolleri
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: {
          id: item.productId,
          businessId,
          isDeleted: false, // ✅ Silinen ürün engellenir
        },
      });

      if (!product) {
        return NextResponse.json({ error: `Ürün bulunamadı: ${item.productId}` }, { status: 404 });
      }

      // ✅ isAvailable kontrolü
      if (!product.isAvailable) {
        return NextResponse.json({ error: `"${product.name}" şu anda mevcut değil.` }, { status: 400 });
      }

      // ✅ stockStatus kontrolü
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

    // ✅ Sipariş oluştur — aktif masa oturumuna bağla
    // ✅ TableSession ve Bill SADECE SİPARİŞ VERİLİNCE oluşturulur
    let tableSession = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (!tableSession) {
      // ✅ İlk sipariş: yeni TableSession oluştur + adisyon aç
      tableSession = await prisma.tableSession.create({
        data: { businessId, tableId, status: "ACTIVE" },
        include: { bill: true },
      });
      await prisma.bill.create({
        data: { businessId, tableId, tableSessionId: tableSession.id, totalAmount: 0, paidAmount: 0, remainingAmount: 0, paymentStatus: "UNPAID", status: "OPEN" },
      });
      tableSession = await prisma.tableSession.findFirst({
        where: { id: tableSession.id },
        include: { bill: true },
      }) as any;
    }

    const order = await prisma.order.create({
      data: {
        businessId,
        tableId,
        tableSessionId: tableSession!.id,
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

    // Adisyon toplamını güncelle
    if (tableSession?.bill) {
      const newTotal = Number(tableSession.bill.totalAmount) + totalPrice;
      const remaining = Math.max(0, newTotal - Number(tableSession.bill.paidAmount));
      await prisma.bill.update({
        where: { id: tableSession.bill.id },
        data: { totalAmount: newTotal, remainingAmount: remaining },
      });
    }

    // ✅ Masa durumunu güncelle — SADECE SİPARİŞ VERİLDİĞİNDE
    await prisma.table.update({
      where: { id: tableId },
      data: { status: TableStatus.HAS_ORDER },
    });

    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        businessId,
        tableId,
        type: "NEW_ORDER",
        title: "Yeni Sipariş",
        message: `${table.tableName || "Masa " + table.tableNumber} yeni sipariş verdi`,
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

    return NextResponse.json({ message: "Sipariş başarıyla oluşturuldu", order }, { status: 201 });
  } catch (error) {
    console.error("Sipariş oluşturma hatası:", error);
    return NextResponse.json({ error: "Sipariş oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}

