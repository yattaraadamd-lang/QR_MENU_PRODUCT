import { NextResponse } from "next/server";

// Kaldırıldı: hiçbir ekran kullanmıyordu. Personel ekranları canlı bildirimi Socket.IO ile,
// sayaçları GET /api/badge-counts ile alır.
const gone = () =>
  NextResponse.json({ error: "Bu uç nokta kaldırıldı." }, { status: 410 });

export const GET = gone;
export const PATCH = gone;
