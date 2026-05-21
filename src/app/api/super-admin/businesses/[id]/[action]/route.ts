import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

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
