import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api/handler";
import { DEMO_AUTO_APPROVE_DELAY_MS, isDemoBusiness } from "@/lib/demo";
import { validateViewSession } from "@/lib/security/validate-customer-session";
import { approveOrderRequest, OrderRequestApprovalError } from "@/lib/services/order-request-approval.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/demo/approve-order-request
 *
 * Yalnız demo işletmesi: yanında garson olmayan ziyaretçi akışı sonuna kadar görebilsin diye
 * oturumun kendi sipariş talebini, garsona süre tanıdıktan sonra sistem onaylar. Süreyi sunucu
 * denetler; istemci erken çağırsa da onay olmaz. Gerçek işletmede bu uç yok hükmündedir (404).
 */
export const POST = withApiHandler("CUSTOMER_DEMO_APPROVE_ORDER_REQUEST", approve);

async function approve(request: NextRequest) {
  const sessionCheck = await validateViewSession(request);
  if (!sessionCheck.ok) {
    return NextResponse.json({ error: sessionCheck.error, code: sessionCheck.code }, { status: sessionCheck.status });
  }
  const customerSession = sessionCheck.customerSession;

  if (!isDemoBusiness(customerSession.businessId)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const pending = await prisma.serviceRequest.findFirst({
    where: {
      customerSessionId: customerSession.id,
      requestType: "ORDER_REQUEST",
      status: { in: ["PENDING", "SEEN"] },
      expiresAt: { gt: new Date() },
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) {
    return NextResponse.json({ error: "Bekleyen sipariş talebi yok.", code: "NO_PENDING_ORDER_REQUEST" }, { status: 409 });
  }

  if (Date.now() - pending.createdAt.getTime() < DEMO_AUTO_APPROVE_DELAY_MS) {
    return NextResponse.json({ error: "Garson onayı bekleniyor.", code: "DEMO_APPROVAL_NOT_DUE" }, { status: 409 });
  }

  try {
    await approveOrderRequest({
      id: pending.id,
      businessId: customerSession.businessId,
      tableId: customerSession.tableId,
      customerSessionId: customerSession.id,
      table: customerSession.table,
    });
  } catch (error) {
    // Garson aynı anda onayladıysa ya da masa başka cihazdaysa durum ucu doğrusunu gösterir
    if (error instanceof OrderRequestApprovalError || (error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Bu talep zaten işlenmiş.", code: "OPEN_REQUEST_ALREADY_HANDLED" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ authorizationStatus: "AUTHORIZED" });
}
