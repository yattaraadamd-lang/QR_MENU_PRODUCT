import { NextResponse } from "next/server";

// Bu eski uç nokta kimlik doğrulaması olmadan masa QR token'ını yeniliyor ve masayı
// OCCUPIED yapıyordu (basılı QR'ı geçersiz kılıp masayı dışarıdan doldurabiliyordu).
// Kaldırıldı — müşteri oturumu /api/customer/session üzerinden açılır.
const gone = () =>
  NextResponse.json({ error: "Bu uç nokta kaldırıldı." }, { status: 410 });

export const GET = gone;
export const POST = gone;
