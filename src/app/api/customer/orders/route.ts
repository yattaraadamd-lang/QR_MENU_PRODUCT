import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { validateAuthorizedTableSession } from "@/lib/security/validate-customer-session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/customer/orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, note, idempotencyKey } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sipariş bilgileri" }, { status: 400 });
    }

    // ✅ Note validasyonu
    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Sipariş notu maksimum 500 karakter olabilir." },
        { status: 400 }
      );
    }

    // ✅ GÜVENLİK: Yetkili masa oturumu doğrulaması
    const sessionCheck = await validateAuthorizedTableSession(request);
    if (!sessionCheck.ok) {
      return NextResponse.json(
        { error: sessionCheck.error, code: sessionCheck.code },
        { status: sessionCheck.status }
      );
    }

    const customerSession = sessionCheck.customerSession;
    const businessId = customerSession.businessId;
    const tableId = customerSession.tableId;
    const tableSessionId = customerSession.tableSessionId!;

    // ✅ RATE LIMIT: 10 saniyede 1 sipariş
    const sessionToken = request.headers.get("x-session-token")!;
    const rateLimit = await checkRateLimit(`order:${sessionToken}`, RATE_LIMITS.ORDER_CREATE);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.`, code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    // ✅ İdempotency check
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: { include: { product: true } }, table: true },
      });
      if (existingOrder) {
        return NextResponse.json({
          message: "Sipariş zaten gönderilmiş.",
          order: existingOrder,
          status: existingOrder.status,
        }, { status: 200 });
      }
    }

    // ✅ SPAM ÖNLEMİ: Aynı ürünlerle son 30 saniyede sipariş var mı?
    const recentOrders = await prisma.order.findMany({
      where: {
        tableId,
        businessId,
        customerSessionId: customerSession.id,
        status: { in: ["PENDING", "ACCEPTED"] },
        createdAt: { gte: new Date(Date.now() - 30 * 1000) },
      },
      include: {
        items: { select: { productId: true, quantity: true } },
      },
    });

    const incomingProductSignature = items
      .map((item: any) => `${item.productId}:${item.quantity}`)
      .sort()
      .join("|");

    for (const recentOrder of recentOrders) {
      const recentProductSignature = recentOrder.items
        .map((item) => `${item.productId}:${item.quantity}`)
        .sort()
        .join("|");

      if (recentProductSignature === incomingProductSignature) {
        return NextResponse.json(
          { error: "Bu siparişi zaten 30 saniye içinde verdiniz. Lütfen bekleyip garsonun onayını kontrol edin." },
          { status: 429 }
        );
      }
    }

    const table = customerSession.table;
    const business = customerSession.business;

    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ✅ Maksimum ürün çeşidi kontrolü
    if (items.length > 50) {
      return NextResponse.json(
        { error: "Bir siparişte maksimum 50 farklı ürün olabilir." },
        { status: 400 }
      );
    }

    // ✅ Ürün kontrolleri ve sunucu tarafı fiyat doğrulaması
    let totalPrice = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!quantity || quantity < 1 || quantity > 100 || !Number.isInteger(quantity)) {
        return NextResponse.json(
          { error: "Geçersiz ürün adedi. Adet 1-100 arasında tam sayı olmalıdır." },
          { status: 400 }
        );
      }

      if (!item.productId || typeof item.productId !== "string") {
        return NextResponse.json({ error: "Geçersiz ürün ID'si." }, { status: 400 });
      }

      if (item.customerNote && item.customerNote.length > 200) {
        return NextResponse.json(
          { error: "Ürün notu maksimum 200 karakter olabilir." },
          { status: 400 }
        );
      }

      const product = await prisma.product.findFirst({
        where: { id: item.productId, businessId, isDeleted: false },
      });

      if (!product) {
        return NextResponse.json({ error: `Ürün bulunamadı: ${item.productId}` }, { status: 404 });
      }

      if (product.businessId !== businessId) {
        return NextResponse.json({ error: "Bu ürün bu işletmeye ait değil." }, { status: 403 });
      }

      if (!product.isAvailable) {
        return NextResponse.json({ error: `"${product.name}" şu anda mevcut değil.` }, { status: 400 });
      }

      if (product.stockStatus !== "IN_STOCK") {
        return NextResponse.json({ error: `"${product.name}" şu anda stokta yok.` }, { status: 400 });
      }

      const backendPrice = Number(product.price);
      if (backendPrice < 0 || !Number.isFinite(backendPrice)) {
        return NextResponse.json(
          { error: `"${product.name}" için geçersiz fiyat bilgisi.` },
          { status: 500 }
        );
      }

      const itemTotal = backendPrice * quantity;
      totalPrice += itemTotal;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: quantity,
        unitPrice: backendPrice,
        totalPrice: itemTotal,
        customerNote: item.customerNote || null,
      });
    }

    if (totalPrice > 1000000) {
      return NextResponse.json(
        { error: "Sipariş tutarı çok yüksek. Lütfen iletişime geçin." },
        { status: 400 }
      );
    }

    // ✅ Transaction: Sipariş oluştur + Bill güncelle + Masa durumu güncelle
    const order = await prisma.$transaction(async (tx) => {
      // Bill kontrolü
      const bill = await tx.bill.findFirst({
        where: { tableSessionId, status: "OPEN" },
      });

      if (!bill) {
        throw new Error("Adisyon bulunamadı. Lütfen garson çağırın.");
      }

      const createdOrder = await tx.order.create({
        data: {
          businessId,
          tableId,
          tableSessionId,
          customerSessionId: customerSession.id,
          idempotencyKey: idempotencyKey || undefined,
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

      // Bill totalAmount güncelle
      const allOrders = await tx.order.findMany({
        where: {
          tableSessionId,
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });

      const newTotalAmount = allOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
      const remainingAmount = Math.max(0, newTotalAmount - Number(bill.paidAmount));

      await tx.bill.update({
        where: { id: bill.id },
        data: { totalAmount: newTotalAmount, remainingAmount },
      });

      // Masa durumunu HAS_ORDER yap
      const currentTable = await tx.table.findUnique({ where: { id: tableId }, select: { status: true } });
      if (currentTable && ["OCCUPIED", "SERVED", "HAS_ORDER"].includes(currentTable.status)) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: "HAS_ORDER" },
        });
      }

      // Bildirim oluştur
      await tx.notification.create({
        data: {
          businessId,
          tableId,
          type: "NEW_ORDER",
          title: "Yeni Sipariş (Onay Bekliyor)",
          message: `${table.tableName || "Masa " + table.tableNumber} sipariş verdi - Onay bekleniyor`,
          soundType: "ORDER",
        },
      });

      return createdOrder;
    });

    // Socket.IO bildirimi
    try {
      emitToBusinessRoom(businessId, "new_order", {
        orderId: order.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        message: `${table.tableName || "Masa " + table.tableNumber} sipariş verdi - Onay bekleniyor`,
        soundType: "new_order",
        totalPrice: Number(order.totalPrice),
        itemCount: order.items.length,
        status: "PENDING",
        createdAt: order.createdAt,
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json({
      message: "Sipariş gönderildi. Garson onayı bekleniyor.",
      order,
      status: "PENDING"
    }, { status: 201 });
  } catch (error: any) {
    // Idempotency key conflict
    if (error?.code === "P2002" && error?.meta?.target?.includes("idempotencyKey")) {
      const existingOrder = await prisma.order.findFirst({
        where: { idempotencyKey: error?.meta?.target },
      });
      if (existingOrder) {
        return NextResponse.json({
          message: "Sipariş zaten gönderilmiş.",
          order: existingOrder,
          status: existingOrder.status,
        }, { status: 200 });
      }
    }
    console.error("Sipariş oluşturma hatası:", error);
    return NextResponse.json({ error: "Sipariş oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}