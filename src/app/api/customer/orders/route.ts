import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { validateCustomerActionSession } from "@/lib/security/validate-customer-session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/customer/orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, items, note } = body;

    if (!businessId || !tableId || !items || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sipariş bilgileri" }, { status: 400 });
    }

    // ✅ GÜVENLIK: Note validasyonu
    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Sipariş notu maksimum 500 karakter olabilir." },
        { status: 400 }
      );
    }

    // ✅ GÜVENLIK: CustomerSession doğrulama
    const sessionCheck = await validateCustomerActionSession(request);
    if (!sessionCheck.ok) {
      return NextResponse.json({ error: sessionCheck.error }, { status: sessionCheck.status });
    }

    const customerSession = sessionCheck.customerSession;

    // ✅ Validate tableId and businessId match session
    if (customerSession.tableId !== tableId || customerSession.businessId !== businessId) {
      return NextResponse.json(
        { error: "Oturum bu masa veya işletme için geçerli değil." },
        { status: 403 }
      );
    }

    // ✅ RATE LIMIT: 10 saniyede 1 sipariş
    const sessionToken = request.headers.get("x-session-token")!;
    const rateLimit = await checkRateLimit(`order:${sessionToken}`, RATE_LIMITS.ORDER_CREATE);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.` },
        { status: 429 }
      );
    }

    const table = customerSession.table;
    const business = customerSession.business;

    // İşletme aktif mi?
    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ✅ Aktif TableSession kontrolü + gerekirse oluştur
    let activeTableSession = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      select: { id: true, startedAt: true },
    });

    // Aktif TableSession yoksa oluştur (ilk sipariş)
    if (!activeTableSession) {
      console.log(`[ORDER] Creating TableSession on first order for tableId=${tableId}`);
      const result = await prisma.$transaction(async (tx) => {
        const newTs = await tx.tableSession.create({
          data: { businessId, tableId, status: "ACTIVE" },
        });
        await tx.bill.create({
          data: {
            businessId,
            tableId,
            tableSessionId: newTs.id,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paymentStatus: "UNPAID",
            status: "OPEN",
          },
        });
        // Masa durumunu OCCUPIED yap
        await tx.table.update({
          where: { id: tableId },
          data: { status: "OCCUPIED" },
        });
        return newTs;
      });
      activeTableSession = { id: result.id, startedAt: result.startedAt };
    }

    // ✅ GÜVENLIK: Maksimum ürün çeşidi kontrolü (spam önleme)
    if (items.length > 50) {
      return NextResponse.json(
        { error: "Bir siparişte maksimum 50 farklı ürün olabilir." },
        { status: 400 }
      );
    }

    // ✅ GÜVENLIK: Ürün kontrolleri ve validasyonlar
    let totalPrice = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      // ✅ Quantity validasyonu
      const quantity = Number(item.quantity);
      if (!quantity || quantity < 1 || quantity > 100 || !Number.isInteger(quantity)) {
        return NextResponse.json(
          { error: "Geçersiz ürün adedi. Adet 1-100 arasında tam sayı olmalıdır." },
          { status: 400 }
        );
      }

      // ✅ ProductId validasyonu
      if (!item.productId || typeof item.productId !== "string") {
        return NextResponse.json({ error: "Geçersiz ürün ID'si." }, { status: 400 });
      }

      // ✅ CustomerNote validasyonu
      if (item.customerNote && item.customerNote.length > 200) {
        return NextResponse.json(
          { error: "Ürün notu maksimum 200 karakter olabilir." },
          { status: 400 }
        );
      }

      const product = await prisma.product.findFirst({
        where: {
          id: item.productId,
          businessId,
          isDeleted: false,
        },
      });

      if (!product) {
        return NextResponse.json({ error: `Ürün bulunamadı: ${item.productId}` }, { status: 404 });
      }

      // ✅ Ürün bu işletmeye ait mi?
      if (product.businessId !== businessId) {
        return NextResponse.json(
          { error: "Bu ürün bu işletmeye ait değil." },
          { status: 403 }
        );
      }

      if (!product.isAvailable) {
        return NextResponse.json({ error: `"${product.name}" şu anda mevcut değil.` }, { status: 400 });
      }

      if (product.stockStatus !== "IN_STOCK") {
        return NextResponse.json({ error: `"${product.name}" şu anda stokta yok.` }, { status: 400 });
      }

      // ✅ GÜVENLIK: Fiyat manipülasyonu koruması - backend DB'den fiyat al
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
        unitPrice: backendPrice, // ✅ Backend'den alınan fiyat
        totalPrice: itemTotal,
        customerNote: item.customerNote || null,
      });
    }

    // ✅ GÜVENLIK: Toplam fiyat kontrolü
    if (totalPrice > 1000000) {
      return NextResponse.json(
        { error: "Sipariş tutarı çok yüksek. Lütfen iletişime geçin." },
        { status: 400 }
      );
    }

    // ✅ Transaction: Sipariş oluştur + Bill güncelle + Masa durumu güncelle
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          businessId,
          tableId,
          tableSessionId: activeTableSession.id,
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
      try {
        const bill = await tx.bill.findFirst({
          where: { tableSessionId: activeTableSession.id, status: "OPEN" },
        });

        if (bill) {
          const allOrders = await tx.order.findMany({
            where: {
              tableSessionId: activeTableSession.id,
              status: { notIn: ["CANCELLED", "REJECTED"] },
            },
          });

          const newTotalAmount = allOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
          const remainingAmount = Math.max(0, newTotalAmount - Number(bill.paidAmount));

          await tx.bill.update({
            where: { id: bill.id },
            data: {
              totalAmount: newTotalAmount,
              remainingAmount,
            },
          });
        }
      } catch (billErr) {
        console.log("Bill güncelleme uyarısı:", billErr);
      }

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
  } catch (error) {
    console.error("Sipariş oluşturma hatası:", error);
    return NextResponse.json({ error: "Sipariş oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}