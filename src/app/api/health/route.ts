import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const startTime = Date.now();
const DB_TIMEOUT_MS = 2000;

/** Veritabanı yavaşladığında sağlık kontrolü de asılı kalmasın */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`DB ${ms} ms içinde yanıt vermedi`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Hazırlık (readiness): instance trafik almaya hazır mı — veritabanı dahil.
 * Harici uptime izleme bunu kullanır. Returns 200 when healthy, 503 when core dependencies
 * (DB) fail or the server is shutting down. Render'ın healthCheckPath'i /api/health/live'dır.
 */
export async function GET() {
  // server.js SIGTERM aldığında işaretler: instance trafikten çekiliyor
  if ((globalThis as { __serverShuttingDown?: boolean }).__serverShuttingDown) {
    return NextResponse.json({
      status: "draining",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      service: "qr-menu-platform",
    }, { status: 503 });
  }

  const startDb = Date.now();
  try {
    // Test database connection and measure latency
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    const dbLatencyMs = Date.now() - startDb;

    // 🔒 SECURITY: Herkese açık endpoint — Node sürümü ve bellek bilgisi döndürülmez
    // (sürüme özel açıkları hedeflemeyi kolaylaştırır)
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      database: {
        status: "connected",
        latencyMs: dbLatencyMs,
      },
      service: "qr-menu-platform",
      version: "1.1.0",
    }, { status: 200 });
  } catch (error) {
    const dbLatencyMs = Date.now() - startDb;
    console.error("[HEALTH_CHECK_FAILED]", {
      error: (error as Error).message,
      latencyMs: dbLatencyMs,
    });
    
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      database: {
        status: "disconnected",
        latencyMs: dbLatencyMs,
      },
      service: "qr-menu-platform",
      error: "Core dependency unavailable",
    }, { status: 503 });
  }
}
