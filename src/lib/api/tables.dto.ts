import "server-only";
import type { Bill, Prisma } from "@prisma/client";
import type { BillDetailDTO, TableBillDTO, TableDTO } from "@/contracts/tables";
import { BILLABLE_ORDER_STATUSES } from "@/lib/services/table-status";

/**
 * Masa uçlarının yanıtı (FE-ARCH-3.1): Prisma seçimi ile src/contracts/tables.ts arasındaki tek
 * eşleme. Seçimden alan çıkarılırsa ya da sözleşmeye alan eklenirse tsc burada kırılır. Decimal
 * metne, Date ISO metnine açıkça çevrilir; JSON'daki biçim değişmez.
 */

/** Masa listesi (admin + garson). Masanın QR token'ı ve talebin doğrulama kodu dönmez. */
export const TABLE_LIST_SELECT = {
  id: true,
  tableNumber: true,
  tableName: true,
  status: true,
  orders: {
    where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  },
  serviceRequests: {
    where: { status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, requestType: true },
  },
  tableSessions: {
    where: { status: "ACTIVE" },
    take: 1,
    select: {
      id: true,
      startedAt: true,
      bill: { select: { id: true, totalAmount: true, paidAmount: true, remainingAmount: true, paymentStatus: true } },
    },
  },
} satisfies Prisma.TableSelect;

type TableListRow = Prisma.TableGetPayload<{ select: typeof TABLE_LIST_SELECT }>;
type BillAmounts = Pick<Bill, "id" | "totalAmount" | "paidAmount" | "remainingAmount" | "paymentStatus">;

function toTableBillDTO(bill: BillAmounts): TableBillDTO {
  return {
    id: bill.id,
    totalAmount: bill.totalAmount.toString(),
    paidAmount: bill.paidAmount.toString(),
    remainingAmount: bill.remainingAmount.toString(),
    paymentStatus: bill.paymentStatus,
  };
}

export function toTableDTO({ tableSessions, ...table }: TableListRow): TableDTO {
  const session = tableSessions[0];
  return {
    id: table.id,
    tableNumber: table.tableNumber,
    tableName: table.tableName,
    status: table.status,
    activeSession: session ? { id: session.id, startedAt: session.startedAt.toISOString() } : null,
    bill: session?.bill ? toTableBillDTO(session.bill) : null,
    orders: table.orders,
    serviceRequests: table.serviceRequests,
  };
}

/** Oturumun adisyonu: yalnız ödenebilir siparişler (liste toplamıyla aynı küme) ve alınmış ödemeler */
export const BILL_DETAIL_SELECT = {
  id: true,
  totalAmount: true,
  paidAmount: true,
  remainingAmount: true,
  paymentStatus: true,
  tableSession: {
    select: {
      orders: {
        where: { status: { in: BILLABLE_ORDER_STATUSES } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          totalPrice: true,
          items: { select: { id: true, productName: true, quantity: true, totalPrice: true } },
        },
      },
    },
  },
  payments: {
    where: { status: "PAID" },
    orderBy: { createdAt: "desc" },
    select: { id: true, method: true, amount: true, handledByWaiterName: true },
  },
} satisfies Prisma.BillSelect;

type BillDetailRow = Prisma.BillGetPayload<{ select: typeof BILL_DETAIL_SELECT }>;

export function toBillDetailDTO(bill: BillDetailRow): BillDetailDTO {
  return {
    ...toTableBillDTO(bill),
    tableSession: {
      orders: bill.tableSession.orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        totalPrice: order.totalPrice.toString(),
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          totalPrice: item.totalPrice.toString(),
        })),
      })),
    },
    payments: bill.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount.toString(),
      handledByWaiterName: payment.handledByWaiterName,
    })),
  };
}
