import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Health check endpoint for Render.com and monitoring
export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      service: "qr-menu-platform",
      version: "1.1.0"
    }, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      service: "qr-menu-platform",
      error: "Database connection failed"
    }, { status: 503 });
  }
}
