import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint to check if schema migrations are applied
 * GET /api/diagnostics/schema
 */
export async function GET() {
  try {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // Check customer_access_blocks columns
    try {
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer_access_blocks'
          AND column_name IN ('revokedById', 'revocationNote')
      `;
      checks.customer_access_blocks_revokedById = result.some((r) => r.column_name === "revokedById");
      checks.customer_access_blocks_revocationNote = result.some((r) => r.column_name === "revocationNote");
    } catch (e: any) {
      errors.push(`customer_access_blocks check failed: ${e.message}`);
    }

    // Check payments columns
    try {
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name IN ('receivedAmount', 'changeAmount', 'idempotencyKey')
      `;
      checks.payments_receivedAmount = result.some((r) => r.column_name === "receivedAmount");
      checks.payments_changeAmount = result.some((r) => r.column_name === "changeAmount");
      checks.payments_idempotencyKey = result.some((r) => r.column_name === "idempotencyKey");
    } catch (e: any) {
      errors.push(`payments check failed: ${e.message}`);
    }

    // Check if all required columns exist
    const allPresent =
      checks.customer_access_blocks_revokedById &&
      checks.customer_access_blocks_revocationNote &&
      checks.payments_receivedAmount &&
      checks.payments_changeAmount &&
      checks.payments_idempotencyKey;

    return NextResponse.json({
      status: allPresent ? "ok" : "missing_columns",
      checks,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      deployRevision: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    });
  } catch (error: any) {
    console.error("[SCHEMA_DIAGNOSTIC_ERROR]", error);
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
