import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { z } from "zod";
import { withApiHandler, parseJson } from "@/lib/api/handler";

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
export const GET = withApiHandler("GET /api/notifications", handleGet);

async function handleGet(request: NextRequest) {
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
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      soundPlayed: true,
      createdAt: true,
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
}

// PATCH /api/notifications — Bildirimleri okundu olarak işaretle (AUTH ZORUNLU)
export const PATCH = withApiHandler("PATCH /api/notifications", handlePatch);

async function handlePatch(request: NextRequest) {
  // ✅ P0-09 FIX: Require WAITER or ADMIN authentication
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;

  const businessId = getBusinessId(session);

  // ✅ Zod validation
  const { notificationIds, markAsRead, markSoundPlayed } = await parseJson(request, patchSchema);

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
}
