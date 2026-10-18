import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response } = await requireSuperAdmin();
    if (error) return response;

    const subscriptions = await prisma.businessSubscription.findMany({
      include: {
        business: { select: { name: true } },
        plan: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, subscriptions });
  } catch (error) {
    console.error("Super Admin subscriptions error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
