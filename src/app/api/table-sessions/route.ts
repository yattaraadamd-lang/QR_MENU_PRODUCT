import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu. Masa kapatma (/api/table-sessions/[id]/close) duruyor.
// Yerine: POST /api/admin/tables/[id]/open (masa açma), GET /api/bills/[sessionId] (adisyon)
const gone = () =>
  NextResponse.json(
    { error: "Bu uç nokta kaldırıldı. Masa açmak için /api/admin/tables/[id]/open kullanın." },
    { status: 410 }
  );

export const GET = gone;
export const POST = gone;
