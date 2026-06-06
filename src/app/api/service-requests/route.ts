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

    // ✅ Transaction ile hizmet talebi + masa durumu + bildirim atomik güncelle
    const result = await prisma.$transaction(async (tx) => {
      // Masa kontrolü
      const table = await tx.table.findFirst({
        where: { id: tableId, businessId, isActive: true, isDeleted: false },
      });

      if (!table) {
        throw new Error("Masa bulunamadı veya aktif değil");
      }

      // ✅ Aktif session kontrolü — EMPTY masadan garson çağrılmamalı
      const activeSession = await tx.tableSession.findFirst({
        where: { tableId, businessId, status: "ACTIVE" },
        select: { id: true },
      });

      if (!activeSession && table.status === "EMPTY") {
        throw new Error("Bu masada aktif oturum yok. Garson çağırmak için masanın açık olması gerekir.");
      }

      // Hizmet talebi oluştur
      const serviceRequest = await tx.serviceRequest.create({
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

      // ✅ Masa durumunu güncelle — geçiş kontrolü ile
      let tableStatus: TableStatus = table.status;

      if (requestType === ServiceRequestType.CALL_WAITER) {
        // Garson çağırma sadece aktif masadan yapılabilir
        if (table.status !== "EMPTY") {
          tableStatus = TableStatus.WAITING_WAITER;
        }
      } else if (requestType === ServiceRequestType.PAYMENT_REQUEST) {
        if (table.status !== "EMPTY") {
          tableStatus = TableStatus.PAYMENT_REQUESTED;
        }
      }

      if (tableStatus !== table.status) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: tableStatus },
        });
      }

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
      await tx.notification.create({
        data: {
          businessId,
          tableId,
          type: notificationType,
          title,
          message,
          soundType,
        },
      });

      return serviceRequest;
    });

    return NextResponse.json(
      {
        message: "Talep başarıyla oluşturuldu",
        serviceRequest: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Hizmet talebi oluşturma hatası:", error);

    if (error.message?.includes("bulunamadı") || error.message?.includes("aktif oturum")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
      where: {
        businessId,
        // ✅ Ödeme talepleri Ödemeler sekmesinde gösterilir, Talepler sayfasına düşmemeli
        requestType: { not: "PAYMENT_REQUEST" },
      },
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
