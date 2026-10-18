import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response } = await requireSuperAdmin();
    if (error) return response;

    // ✅ SECURITY: Açık select — şifre hash'i asla istemciye gönderilmez
    const users = await prisma.user.findMany({
      select: {
        id: true,
        businessId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        business: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Super Admin users error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
