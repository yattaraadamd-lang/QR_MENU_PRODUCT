import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const startTime = Date.now();

/**
 * Health check endpoint for container orchestrators, uptime monitoring and APM.
 * Returns 200 when healthy, 503 when core dependencies (DB) fail.
 */
export async function GET() {
  const startDb = Date.now();
  try {
    // Test database connection and measure latency
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startDb;
    
    const memoryUsage = process.memoryUsage ? process.memoryUsage() : null;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      database: {
        status: "connected",
        latencyMs: dbLatencyMs,
      },
      system: {
        nodeVersion: process.version,
        memoryRssMb: memoryUsage ? Math.round(memoryUsage.rss / 1024 / 1024) : undefined,
        memoryHeapUsedMb: memoryUsage ? Math.round(memoryUsage.heapUsed / 1024 / 1024) : undefined,
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
