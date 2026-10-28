import { NextResponse } from "next/server";

// Kaldırıldı: yalnız talep kaydını güncelliyordu. Sipariş talebi iptalinde müşteri oturumu
// onay beklerken kalıyor, masa durumu yeniden hesaplanmıyor ve socket olayı gitmiyordu.
// Yerine: PUT /api/waiter/service-requests/[id]/status, POST …/[id]/reject-order-request
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Talep durumu için /api/waiter/service-requests/[id]/status kullanın." },
    { status: 410 }
  );

export const PATCH = gone;
