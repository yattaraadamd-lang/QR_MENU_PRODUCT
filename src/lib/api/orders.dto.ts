import "server-only";
import type { Prisma } from "@prisma/client";
import type { AdminOrderDTO, OrderDTO } from "@/contracts/orders";

/**
 * Sipariş listelerinin yanıtı (FE-ARCH-3.1): Prisma seçimi ile src/contracts/orders.ts arasındaki
 * tek eşleme. Decimal metne, Date ISO metnine açıkça çevrilir; JSON'daki biçim değişmez.
 */

/** Garson ve admin sipariş listeleri */
export const ORDER_LIST_SELECT = {
  id: true,
  totalPrice: true,
  status: true,
  note: true,
  // Kartta iptal/red nedeni gösterilir
  cancelReason: true,
  createdAt: true,
  table: { select: { tableNumber: true, tableName: true } },
  waiter: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      // "Stokta yok" ile iptal ederken hangi ürünün işaretleneceği buradan seçilir
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      customerNote: true,
    },
  },
} satisfies Prisma.OrderSelect;

/** Admin listesi ödeme durumunu da gösterir */
export const ADMIN_ORDER_LIST_SELECT = { ...ORDER_LIST_SELECT, paymentStatus: true } satisfies Prisma.OrderSelect;

type OrderListRow = Prisma.OrderGetPayload<{ select: typeof ORDER_LIST_SELECT }>;
type AdminOrderListRow = Prisma.OrderGetPayload<{ select: typeof ADMIN_ORDER_LIST_SELECT }>;

export function toOrderDTO(order: OrderListRow): OrderDTO {
  return {
    id: order.id,
    table: order.table,
    totalPrice: order.totalPrice.toString(),
    note: order.note,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    cancelReason: order.cancelReason,
    waiter: order.waiter,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      customerNote: item.customerNote,
    })),
  };
}

export function toAdminOrderDTO(order: AdminOrderListRow): AdminOrderDTO {
  return { ...toOrderDTO(order), paymentStatus: order.paymentStatus };
}
