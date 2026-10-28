import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu ve PATCH sipariş durumunu geçiş kuralına bakmadan
// değiştirebiliyordu (stok, adisyon ve socket güncellemesi olmadan).
// Yerine: PUT /api/waiter/orders/[id]/status, PUT /api/admin/orders/[orderId]/cancel
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Sipariş durumu için /api/waiter/orders/[id]/status kullanın." },
    { status: 410 }
  );

export const PATCH = gone;
export const DELETE = gone;
