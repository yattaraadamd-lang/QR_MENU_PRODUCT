import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// GET /api/bills/[sessionId] — Oturumun adisyonunu getir (admin + garson)
export const GET = withApiHandler("GET /api/bills/[sessionId]", handleGet);

async function handleGet(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const params = await context.params;
  
  // Admin veya garson erişebilir
  const waiterCheck = await requireWaiterOrAdmin();
  if (waiterCheck.error) return waiterCheck.response!;
  const businessId = getBusinessId(waiterCheck.session);

  const bill = await prisma.bill.findFirst({
    where: { tableSessionId: params.sessionId, businessId },
    include: {
      tableSession: {
        include: {
          orders: {
            // ✅ Sadece ödenebilir durumdaki siparişler — REJECTED ve CANCELLED hariç
            where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
            include: { items: { include: { product: true } }, waiter: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      payments: {
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });
  return NextResponse.json({ bill });
}

// POST kaldırıldı: hiçbir ekran kullanmıyordu ve toplamı ödeme servisinden farklı kurallarla
// (float, PENDING hariç) yeniden yazıyordu. Adisyon toplamlarını ödeme/sipariş servisleri günceller.
export const POST = () =>
  NextResponse.json({ error: "Bu uç nokta kaldırıldı." }, { status: 410 });
