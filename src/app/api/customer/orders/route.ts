import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// ✅ Oturum token kontrolü — CustomerSession tablosundan doğrula
async function validateSessionToken(
  request: NextRequest,
  tableId: string
): Promise<{ valid: boolean; error?: string }> {
  const sessionToken = request.headers.get("x-session-token");
  if (!sessionToken) {
    return {
      valid: false,
      error: "Sipariş vermek için masadaki QR kodu okutmanız gerekir.",
    };
  }

  // ✅ CustomerSession tablosundan doğrula
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
    const { businessId, tableId, items, note } = body;

    if (!businessId || !tableId || !items || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sipariş bilgileri" }, { status: 400 });
    }

    // Session token kontrolü
    const tokenValidation = await validateSessionToken(request, tableId);
    if (!tokenValidation.valid) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 401 });
    }

    // ✅ İkinci güvenlik katmanı: Bu masa için ACTIVE TableSession var mı?
    // ✅ Aynı zamanda 90 dakika süre kontrolü
    const SESSION_DURATION_MS = 90 * 60 * 1000;

    const activeTableSession = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      select: { id: true, startedAt: true },
    });

    if (!activeTableSession) {
      return NextResponse.json(
        { error: "Bu masa şu anda aktif değil. Sipariş verilemez." },
        { status: 403 }
      );
    }

    const sessionExpired =
      Date.now() - activeTableSession.startedAt.getTime() > SESSION_DURATION_MS;

    if (sessionExpired) {
      // Oturumu kapat
      await prisma.tableSession.update({
        where: { id: activeTableSession.id },
        data: { status: "CLOSED", endedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Masa oturumunun süresi doldu. Lütfen QR kodu tekrar okutun." },
        { status: 403 }
      );
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

    // Ürün kontrolleri
    let totalPrice = 0;
    const orderItems: any[] = [];

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

    // ✅ Transaction: Sipariş oluştur + Bill güncelle + Masa durumu güncelle
    const order = await prisma.$transaction(async (tx) => {
      // Sipariş oluştur — aktif TableSession'a bağla
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

      // ✅ Bill totalAmount güncelle (server-side, inline)
      try {
        const bill = await tx.bill.findFirst({
          where: { tableSessionId: activeTableSession.id, status: "OPEN" },
        });

        if (bill) {
          // Tüm aktif siparişlerin toplamını hesapla
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
        // Bill güncelleme hatası siparişi engellemez
        console.log("Bill güncelleme uyarısı:", billErr);
      }

      // ✅ Masa durumunu HAS_ORDER yap (uygun durumlardan)
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
