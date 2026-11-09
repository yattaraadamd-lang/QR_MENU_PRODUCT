/**
 * Sipariş tipleri (garson + admin). API sözleşmesi src/contracts/orders.ts'te; sunucu aynı
 * tiplerle döner (src/lib/api/orders.dto.ts).
 */

export type {
  AdminOrderDTO,
  AdminOrderListResponse,
  CancelPayload,
  CancelReasonCode,
  OrderDTO,
  OrderItemDTO,
  OrderPaymentStatus,
  OrderStatus,
  WaiterOrderListResponse,
} from "@/contracts/orders";
