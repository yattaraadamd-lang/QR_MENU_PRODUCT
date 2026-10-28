import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu; aynı işi denetim kaydı ve listeleme ile
// POST /api/admin/waiter-invites yapar.
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Davet kodu için /api/admin/waiter-invites kullanın." },
    { status: 410 }
  );

export const POST = gone;
