import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX P0-01: Admin-only invite creation with cryptographically secure codes
 * 
 * CHANGES:
 * - Added requireAdmin() authentication
 * - businessId from session (not client)
 * - CSPRNG-generated invite codes (128-bit entropy)
 * - Mandatory expiry (7 days)
 * - Single-use enforcement
 * - Rate limiting TODO (needs Redis)
 * - Audit logging TODO
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ P0-01 FIX: Require ADMIN authentication
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    // ✅ P0-01 FIX: businessId from session, NOT from client
    const businessId = getBusinessId(session);
    
    // ✅ Verify business exists and is active
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business || !business.isActive) {
      return NextResponse.json(
        { error: "İşletme bulunamadı veya aktif değil" },
        { status: 404 }
      );
    }

    // ✅ P0-01 FIX: Generate cryptographically secure invite code
    // 128-bit entropy = 32 hex characters = ~10^38 possibilities
    const secureCode = `inv_${crypto.randomBytes(16).toString("hex")}`;

    // ✅ P0-01 FIX: Mandatory expiry (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // ✅ Create invite with secure defaults
    const invite = await prisma.waiterInvite.create({
      data: {
        businessId,
        inviteCode: secureCode,
        isUsed: false,
        expiresAt,
      },
      select: {
        id: true,
        inviteCode: true,
        expiresAt: true,
        createdAt: true,
        // ❌ Don't return businessId to avoid enumeration
      },
    });

    // ✅ TODO: Audit log
    // await createAuditLog({
    //   businessId,
    //   actorUserId: session!.user.id,
    //   action: "INVITE_CREATED",
    //   entityType: "WaiterInvite",
    //   entityId: invite.id,
    // });

    return NextResponse.json(
      {
        message: "Davet kodu oluşturuldu",
        invite: {
          inviteCode: invite.inviteCode,
          expiresAt: invite.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[INVITE_CREATE_ERROR]", {
      code: (error as any)?.code,
      message: (error as any)?.message,
      // ❌ DO NOT log secrets or tokens
    });
    
    return NextResponse.json(
      { error: "Davet kodu oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
