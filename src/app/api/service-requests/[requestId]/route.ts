import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { serviceRequestStatusSchema } from "@/lib/validation";

export const PATCH = withApiHandler("PATCH /api/service-requests/[requestId]", handlePatch);

async function handlePatch(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  // ✅ GÜVENLIK: Auth zorunlu — sadece garson veya admin güncelleyebilir
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;

  const businessId = getBusinessId(session);
  const params = await context.params;
  const { requestId } = params;
  const { status } = await parseJson(request, serviceRequestStatusSchema);

  if (!status) {
    return NextResponse.json(
      { error: "Durum bilgisi gerekli" },
      { status: 400 }
    );
  }
  // Bilinmeyen durum Prisma enum hatasıyla 500 veriyordu
  if (!(Object.values(RequestStatus) as string[]).includes(status)) {
    return NextResponse.json(
      { error: "Geçersiz talep durumu" },
      { status: 400 }
    );
  }

  // ✅ GÜVENLIK: Business izolasyonu — sadece kendi işletmesinin talebini güncelleyebilir
  const existing = await prisma.serviceRequest.findFirst({
    where: {
      id: requestId,
      businessId,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Talep bulunamadı veya yetkiniz yok" },
      { status: 404 }
    );
  }

  const updateData: { status: RequestStatus; completedAt?: Date } = { status: status as RequestStatus };
  if (status === RequestStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }

  const serviceRequest = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: updateData,
    include: {
      table: true,
    },
  });

  return NextResponse.json({
    message: "Talep durumu güncellendi",
    serviceRequest,
  });
}

