import { NextResponse } from "next/server";

// Bu eski uç nokta kimlik doğrulaması olmadan herhangi bir işletmeye davet kodu üretiyordu.
// Kaldırıldı — yerine: /api/admin/waiter-invites
export const POST = () =>
  NextResponse.json({ error: "Bu uç nokta kaldırıldı." }, { status: 410 });
