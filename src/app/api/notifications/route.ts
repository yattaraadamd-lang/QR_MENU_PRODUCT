import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX P0-09: Notifications API — Auth + Tenant Isolation
 *
 * CRITICAL CHANGES:
 * - GET: requireWaiterOrAdmin() authentication enforced
 * - GET: businessId from authenticated session (NOT query string)
 * - PATCH: requireWaiterOrAdmin() authentication enforced
 * - PATCH: Notification ownership validated against session businessId
 * - Zod validation on all inputs
 * - No sensitive data leakage
 *
 * PREVIOUSLY: Anyone could read/modify ANY business's notifications
 * by passing arbitrary businessId in query string.
 */

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const patchSchema = z.object({
  notificationIds: z
    .array(z.string().min(1).max(200))
    .min(1, "En az 1 bildirim ID'si gerekli")
    .max(100, "Maksimum 100 bildirim güncellenebilir"),
  markAsRead: z.boolean().optional(),
  markSoundPlayed: z.boolean().optional(),
}).strict();

// GET /api/notifications — Bildirimleri getir (AUTH ZORUNLU)
export async function GET(request: NextRequest) {
  try {
    // ✅ P0-09 FIX: Require WAITER or ADMIN authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    // ✅ P0-09 FIX: businessId from session (NOT from client query)
    const businessId = getBusinessId(session);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where: Record<string, unknown> = { businessId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
            tableName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[NOTIFICATION_LIST_ERROR]", {
      code: (err as any)?.code,
      message: (err as any)?.message,
    });
    return NextResponse.json(
      { error: "Bildirimler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — Bildirimleri okundu olarak işaretle (AUTH ZORUNLU)
export async function PATCH(request: NextRequest) {
  try {
    // ✅ P0-09 FIX: Require WAITER or ADMIN authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    const body = await request.json();

    // ✅ Zod validation
    const parseResult = patchSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Geçersiz veri";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { notificationIds, markAsRead, markSoundPlayed } = parseResult.data;

    if (!markAsRead && !markSoundPlayed) {
      return NextResponse.json(
        { error: "En az bir güncelleme seçeneği gerekli (markAsRead veya markSoundPlayed)" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (markAsRead) {
      updateData.isRead = true;
      updateData.seenAt = new Date();
    }

    if (markSoundPlayed) {
      updateData.soundPlayed = true;
      updateData.notifiedAt = new Date();
    }

    // ✅ P0-09 FIX: Only update notifications belonging to THIS business
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        businessId, // ✅ CRITICAL: Tenant scope — prevents cross-business manipulation
      },
      data: updateData,
    });

    return NextResponse.json({
      message: "Bildirimler güncellendi",
      count: result.count,
    });
  } catch (err) {
    console.error("[NOTIFICATION_UPDATE_ERROR]", {
      code: (err as any)?.code,
      message: (err as any)?.message,
    });
    return NextResponse.json(
      { error: "Bildirimler güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
