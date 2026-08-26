import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX: Unified invite code system with SHA-256 hashing
 * 
 * CHANGES:
 * - Replaced UUID with crypto.randomBytes (CSPRNG)
 * - Store invite codes as SHA-256 hashes
 * - Return RAW code to admin (only in creation response)
 * - List endpoint returns metadata only (no raw codes)
 * - Mandatory 7-day expiry
 * - Compatible with /api/auth/register hash validation
 */

/**
 * Hash an invite code for storage (matches register.ts)
 */
function hashInviteCode(rawCode: string): string {
  return crypto.createHash("sha256").update(rawCode).digest("hex");
}

// GET /api/admin/waiter-invites - Davet kodlarını listele
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    
    // ✅ SECURITY: Don't return raw invite codes or hashes in list
    // Admins can only see metadata about invites
    const invites = await prisma.waiterInvite.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        isUsed: true,
        usedByUserId: true,
        usedAt: true,
        expiresAt: true,
        createdAt: true,
        // ❌ Don't select inviteCode (it's a hash, not useful to display)
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Davet kodu listeleme hatası:", error);
    return NextResponse.json(
      { error: "Davet kodları yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST /api/admin/waiter-invites - Davet kodu oluştur
export async function POST(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    // ✅ SECURITY: Generate cryptographically secure invite code
    // 128-bit entropy = 32 hex characters
    const rawCode = `inv_${crypto.randomBytes(16).toString("hex")}`;
    
    // ✅ Store ONLY the hash in database
    const codeHash = hashInviteCode(rawCode);

    // ✅ Mandatory expiry (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // ✅ Create invite with secure defaults
    const invite = await prisma.waiterInvite.create({
      data: {
        businessId,
        inviteCode: codeHash, // ✅ Hash stored, not raw code
        isUsed: false,
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        isUsed: true,
      },
    });

    return NextResponse.json(
      {
        message: "Davet kodu oluşturuldu",
        invite: {
          ...invite,
          inviteCode: rawCode, // ✅ RAW code returned ONLY here, ONCE
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Davet kodu oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Davet kodu oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
