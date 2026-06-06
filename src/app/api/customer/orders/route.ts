import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { updateBillAfterOrder } from "@/lib/services/table-flow.service";

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

    // ✅ Transaction içinde tüm işlemleri yap
    const result = await prisma.$transaction(async (tx) => {
      // ✅ Aktif TableSession kontrolü + 90 dakika süre kontrolü
      const SESSION_DURATION_MS = 90 * 60 * 1000;

      const activeTableSession = await tx.tableSession.findFirst({
        where: { tableId, businessId, status: "ACTIVE" },
        select: { id: true, startedAt: true },
      });

      if (!activeTableSession) {
        throw new Error("Bu masa şu anda aktif değil. Sipariş verilemez.");
      }

      const sessionExpired =
        Date.now() - activeTableSession.startedAt.getTime() > SESSION_DURATION_MS;

      if (sessionExpired) {
        // Oturumu kapat
        await tx.tableSession.update({
          where: { id: activeTableSession.id },
          data: { status: "CLOSED", endedAt: new Date() },
        });
        throw new Error("Masa oturumunun süresi doldu. Lütfen QR kodu tekrar okutun.");
      }

      // Masa ve işletme kontrolü — silinen masa engellenir
      const table = await tx.table.findFirst({
        where: { id: tableId, businessId, isActive: true, isDeleted: false },
        include: { business: true },
      });

      if (!table || !table.business) {
        throw new Error("Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin.");
      }

      const business = table.business;

      // İşletme aktif mi?
      if (!business.isActive) {
        throw new Error("İşletme şu anda hizmet vermiyor.");
      }

      // Ürün kontrolleri — fiyat server-side hesaplanıyor
      let totalPrice = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            businessId,
            isDeleted: false,
          },
        });

        if (!product) {
          throw new Error(`Ürün bulunamadı: ${item.productId}`);
        }

        if (!product.isAvailable) {
          throw new Error(`"${product.name}" şu anda mevcut değil.`);
        }

        if (product.stockStatus !== "IN_STOCK") {
          throw new Error(`"${product.name}" şu anda stokta yok.`);
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

      // ✅ Sipariş oluştur — aktif TableSession'a bağla
      const order = await tx.order.create({
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

      // ✅ Bill totalAmount güncelle (server-side)
      await updateBillAfterOrder(tx, activeTableSession.id);

      // ✅ Masa durumunu HAS_ORDER yap (eğer uygunsa)
      if (table.status === "OCCUPIED" || table.status === "SERVED") {
        await tx.table.update({
          where: { id: tableId },
          data: { status: TableStatus.HAS_ORDER },
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

      return { order, table };
    });

    // Socket.IO bildirimi (transaction dışında)
    try {
      emitToBusinessRoom(result.table.businessId, "new_order", {
        orderId: result.order.id,
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        message: `${result.table.tableName || "Masa " + result.table.tableNumber} sipariş verdi - Onay bekleniyor`,
        soundType: "new_order",
        totalPrice: Number(result.order.totalPrice),
        itemCount: result.order.items.length,
        status: "PENDING",
        createdAt: result.order.createdAt,
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json({ 
      message: "Sipariş gönderildi. Garson onayı bekleniyor.", 
      order: result.order,
      status: "PENDING"
    }, { status: 201 });
  } catch (error: any) {
    console.error("Sipariş oluşturma hatası:", error);
    
    // Transaction error'larını kullanıcıya ilet
    if (error.message && (
      error.message.includes("aktif değil") ||
      error.message.includes("Ürün") ||
      error.message.includes("stokta") ||
      error.message.includes("süresi doldu") ||
      error.message.includes("QR kod") ||
      error.message.includes("hizmet vermiyor") ||
      error.message.includes("mevcut değil")
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Sipariş oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
