import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getClientIp, RateLimitPresets, createRateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - Hizmet talebi oluşturma
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimit({
      ...RateLimitPresets.SERVICE_REQUEST,
      identifier: `service_${clientIp}`,
    });

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const { businessId, tableId, requestType, note } = body;

    if (!businessId || !tableId || !requestType) {
      return NextResponse.json(
        { error: "Geçersiz talep bilgileri" },
        { status: 400 }
      );
    }

    // Hizmet talebi oluştur
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        businessId,
        tableId,
        requestType,
        note: note || null,
        status: RequestStatus.PENDING,
      },
      include: {
        table: true,
      },
    });

    // Masa durumunu güncelle
      let tableStatus: TableStatus = TableStatus.OCCUPIED;

    if (requestType === ServiceRequestType.CALL_WAITER) {
      tableStatus = TableStatus.WAITING_WAITER;
    } else if (requestType === ServiceRequestType.PAYMENT_REQUEST) {
      tableStatus = TableStatus.PAYMENT_REQUESTED;
    }

    await prisma.table.update({
      where: { id: tableId },
      data: { status: tableStatus },
    });

    // Bildirim türünü belirle
    let notificationType: any = "SERVICE_REQUEST";
    let soundType: any = "DEFAULT";
    let title = "Hizmet Talebi";
    let message = `Masa ${serviceRequest.table.tableNumber} hizmet talep etti`;

    if (requestType === ServiceRequestType.CALL_WAITER) {
      notificationType = "CALL_WAITER";
      soundType = "WAITER_CALL";
      title = "Garson Çağrısı";
      message = `Masa ${serviceRequest.table.tableNumber} garson çağırdı`;
    } else if (requestType === ServiceRequestType.PAYMENT_REQUEST) {
      notificationType = "PAYMENT_REQUEST";
      soundType = "PAYMENT";
      title = "Ödeme Talebi";
      message = `Masa ${serviceRequest.table.tableNumber} ödeme istiyor`;
    }

    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        businessId,
        tableId,
        type: notificationType,
        title,
        message,
        soundType,
      },
    });

    return NextResponse.json(
      {
        message: "Talep başarıyla oluşturuldu",
        serviceRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Hizmet talebi oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Talep oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Bu endpoint artık korunmalı - sadece authenticated kullanıcılar erişebilir
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme ID gerekli" },
        { status: 400 }
      );
    }

    // Kullanıcının bu işletmeye erişim yetkisi var mı kontrol et
    if (session.user.role !== "SUPER_ADMIN") {
      const userBusinessId = session.user.businessId;
      if (userBusinessId !== businessId) {
        return NextResponse.json(
          { error: "Bu işletmenin taleplerine erişim yetkiniz yok" },
          { status: 403 }
        );
      }
    }

    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { businessId },
      include: {
        table: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ serviceRequests });
  } catch (error) {
    console.error("Hizmet talepleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Talepler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
