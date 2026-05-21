import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim" },
        { status: 403 }
      );
    }

    const businesses = await prisma.business.findMany({
      include: {
        _count: {
          select: {
            tables: true,
            products: true,
          },
        },
        businessSubscriptions: {
          where: { status: "ACTIVE" },
          include: { plan: true },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, businesses });
  } catch (error) {
    console.error("Super Admin businesses data error:", error);

    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}