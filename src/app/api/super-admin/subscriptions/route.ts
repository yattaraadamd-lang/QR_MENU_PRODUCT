import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

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
