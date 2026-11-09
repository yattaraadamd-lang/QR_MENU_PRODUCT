import { NextRequest, NextResponse } from "next/server";
import type { BillDetailResponse } from "@/contracts/tables";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";
import { BILL_DETAIL_SELECT, toBillDetailDTO } from "@/lib/api/tables.dto";

export const dynamic = "force-dynamic";

// GET /api/bills/[sessionId] — Oturumun adisyonunu getir (admin + garson)
export const GET = withApiHandler("GET /api/bills/[sessionId]", handleGet);

async function handleGet(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const params = await context.params;
  
  // Admin veya garson erişebilir
  const waiterCheck = await requireWaiterOrAdmin();
  if (waiterCheck.error) return waiterCheck.response!;
  const businessId = getBusinessId(waiterCheck.session);

  // Yalnız ödenebilir siparişler (liste adisyon toplamıyla aynı küme) ve alınmış ödemeler
  const bill = await prisma.bill.findFirst({
    where: { tableSessionId: params.sessionId, businessId },
    select: BILL_DETAIL_SELECT,
  });

  if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });
  return NextResponse.json({ bill: toBillDetailDTO(bill) } satisfies BillDetailResponse);
}

// POST kaldırıldı: hiçbir ekran kullanmıyordu ve toplamı ödeme servisinden farklı kurallarla
// (float, PENDING hariç) yeniden yazıyordu. Adisyon toplamlarını ödeme/sipariş servisleri günceller.
export const POST = () =>
  NextResponse.json({ error: "Bu uç nokta kaldırıldı." }, { status: 410 });
