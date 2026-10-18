import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response } = await requireSuperAdmin();
    if (error) return response;

    // Placeholder - platform payment records will be populated when subscription billing is active
    return NextResponse.json({ success: true, payments: [] });
  } catch (error) {
    console.error("Super Admin platform-payments error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
