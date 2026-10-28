import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu.
// Yerine: GET /api/admin/tables, GET /api/waiter/tables
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Masalar için /api/admin/tables ya da /api/waiter/tables kullanın." },
    { status: 410 }
  );

export const GET = gone;
