import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, requireAdmin, getBusinessId } from "@/lib/auth-helpers";
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

// POST /api/bills/[sessionId]/recalculate — Adisyonu yeniden hesapla
export const POST = withApiHandler("POST /api/bills/[sessionId]", handlePost);

async function handlePost(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const params = await context.params;
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);

  const bill = await prisma.bill.findFirst({
    where: { tableSessionId: params.sessionId, businessId },
  });
  if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });

  // ✅ Sadece ödenebilir durumdaki siparişlerin toplamı
  // REJECTED ve CANCELLED siparişler toplama dahil edilmez
  const orders = await prisma.order.findMany({
    where: {
      tableSessionId: params.sessionId,
      status: { in: ["SERVED", "ACCEPTED", "PREPARING"] },
    },
  });
  const totalAmount = orders.reduce((s, o) => s + Number(o.totalPrice), 0);

  // Tamamlanan ödemelerin toplamı
  const payments = await prisma.payment.findMany({
    where: { billId: bill.id, status: "PAID" },
  });
  const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
  if (remainingAmount === 0 && totalAmount > 0) paymentStatus = "PAID";
  else if (paidAmount > 0) paymentStatus = "PARTIALLY_PAID";

  const updated = await prisma.bill.update({
    where: { id: bill.id },
    data: { totalAmount, paidAmount, remainingAmount, paymentStatus },
  });

  return NextResponse.json({ bill: updated });
}
