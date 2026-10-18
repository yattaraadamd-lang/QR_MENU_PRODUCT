import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const params = await context.params;
    const { error, response } = await requireSuperAdmin();
    if (error) return response;

    const { id, action } = params;

    if (action !== "activate" && action !== "deactivate") {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    const business = await prisma.business.update({
      where: { id },
      data: { isActive: action === "activate" },
    });

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error("Super Admin business update error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
