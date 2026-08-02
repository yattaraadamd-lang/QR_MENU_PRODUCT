import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Cihaz hash'ini maskele — ilk 8 ve son 4 karakter göster.
 * Tam hash değeri frontend'e gönderilmez.
 */
function maskDeviceHash(hash: string): string {
  if (!hash || hash.length <= 12) return "****";
  return hash.slice(0, 8) + "…" + hash.slice(-4);
}

// GET /api/admin/customer-access-blocks — İşletmenin cihaz engellerini listele
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const { businessId, userId } = authResult.session;
    const { searchParams } = new URL(request.url);

    // ── Filtreler ────────────────────────────────────────────────────────
    const statusFilter = searchParams.get("status") || "active";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // ── Where koşulu ────────────────────────────────────────────────────
    let where: any = { businessId };
    if (statusFilter === "active") {
      where.revokedAt = null;
    } else if (statusFilter === "revoked") {
      where.revokedAt = { not: null };
    }
    // "all" ise ek filtre yok

    // ── Veritabanı sorgusu ──────────────────────────────────────────────
    const [blocks, total] = await Promise.all([
      prisma.customerAccessBlock.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.customerAccessBlock.count({ where }),
    ]);

    // ── createdById ve revokedById'den personel adlarını getir ─────────
    const userIds = new Set<string>();
    blocks.forEach((b) => {
      if (b.createdById) userIds.add(b.createdById);
      if (b.revokedById) userIds.add(b.revokedById);
    });

    const users = userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // ── Yanıt dönüştür — hassas bilgileri gizle ──────────────────────────
    const maskedBlocks = blocks.map((block) => ({
      id: block.id,
      maskedDeviceHash: maskDeviceHash(block.deviceKeyHash),
      reason: block.reason,
      sourceRequestId: block.sourceRequestId,
      createdById: block.createdById,
      createdByName: block.createdById ? userMap.get(block.createdById) || null : null,
      createdAt: block.createdAt,
      revokedAt: block.revokedAt,
      revokedById: block.revokedById,
      revokedByName: block.revokedById ? userMap.get(block.revokedById) || null : null,
      revocationNote: block.revocationNote,
      status: block.revokedAt ? "revoked" : "active",
    }));

    return NextResponse.json({
      blocks: maskedBlocks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Cihaz engelleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Cihaz engelleri yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
