import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { businessId } = session.user;

    const bills = await prisma.bill.findMany({
      where: {
        businessId,
        status: "OPEN",
        totalAmount: { gt: 0 },
        remainingAmount: { gt: 0 }
      },
      include: {
        table: true,
        tableSession: {
          include: {
            orders: {
              where: { status: { not: "CANCELLED" } }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ bills });
  } catch (error) {
    console.error("Bekleyen ödemeler getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
