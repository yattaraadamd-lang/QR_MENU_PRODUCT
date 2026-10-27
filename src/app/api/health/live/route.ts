import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Canlılık (liveness): süreç ayakta ve istek işleyebiliyor mu — veritabanına bakmaz.
 *
 * Render'ın healthCheckPath'i budur. Veritabanı kesintisinde Render instance'ı boş yere
 * yeniden başlatmasın: yeniden başlatmak veritabanını düzeltmez, yalnız açık soketleri koparır.
 * Bağımlılıklarla birlikte hazır olma durumu /api/health'tedir (harici uptime izleme).
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
