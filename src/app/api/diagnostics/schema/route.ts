import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * 🔒 P0-09 FIX: Diagnostic endpoint — SuperAdmin only
 *
 * PREVIOUSLY: No authentication. Exposed database schema info to anyone.
 *
 * NOW: requireSuperAdmin(). Only super admin can check schema diagnostics.
 *
 * In production, consider disabling entirely or gating with NODE_ENV.
 */
export async function GET() {
  try {
    // ✅ P0-09 FIX: Only super admin can access diagnostics
    const { error, response } = await requireSuperAdmin();
    if (error) return response!;

    // ✅ SECURITY: Block in production unless explicitly allowed
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DIAGNOSTICS) {
      return NextResponse.json(
        { error: "Diagnostics disabled in production" },
        { status: 403 }
      );
    }

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
    });
  } catch (error: any) {
    console.error("[SCHEMA_DIAGNOSTIC_ERROR]", error);
    return NextResponse.json(
      {
        status: "error",
        // ✅ P0-09 FIX: Don't expose error details to client
        error: "Diagnostic check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
