import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu; masa durumunu socket güncellemesi olmadan değiştiriyordu.
// Yerine: PUT /api/waiter/tables (durum), POST /api/admin/tables/[id]/open (masa açma)
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Masa durumu için /api/waiter/tables kullanın." },
    { status: 410 }
  );

export const PATCH = gone;
