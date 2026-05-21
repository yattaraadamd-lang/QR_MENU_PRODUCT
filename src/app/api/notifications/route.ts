import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/notifications - Bildirimleri getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    if (!businessId) {
      return NextResponse.json(
        { error: "İşletme ID gerekli" },
        { status: 400 }
      );
    }

    const where: any = { businessId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        table: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Bildirim listeleme hatası:", error);
    return NextResponse.json(
      { error: "Bildirimler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Bildirimleri okundu olarak işaretle
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, markAsRead, markSoundPlayed } = body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: "Bildirim ID'leri gerekli" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    if (markAsRead) {
      updateData.isRead = true;
      updateData.seenAt = new Date();
    }

    if (markSoundPlayed) {
      updateData.soundPlayed = true;
      updateData.notifiedAt = new Date();
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: updateData,
    });

    return NextResponse.json({
      message: "Bildirimler güncellendi",
      count: notificationIds.length,
    });
  } catch (error) {
    console.error("Bildirim güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Bildirimler güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
