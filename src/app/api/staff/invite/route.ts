import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";
import { checkPlanQuota } from "@/lib/services/subscription-guard.service";
import { generateInviteCode, hashInviteCode, buildInviteUrl, INVITE_TTL_MS } from "@/lib/invite";
import { withApiHandler } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX P0-01: Admin-only invite creation with cryptographically secure codes
 * 
 * CHANGES:
 * - Added requireAdmin() authentication
 * - businessId from session (not client)
 * - CSPRNG-generated invite codes (128-bit entropy)
 * - Invite code stored as SHA-256 hash in database
 * - Raw code returned ONLY in creation response
 * - Mandatory expiry (7 days)
 * - Single-use enforcement
 */

export const POST = withApiHandler("POST /api/staff/invite", handlePost);

async function handlePost(request: NextRequest) {
  // ✅ P0-01 FIX: Require ADMIN authentication
  const { error, response, session } = await requireAdmin();
  if (error) return response!;

  // ✅ P0-01 FIX: businessId from session, NOT from client
  const businessId = getBusinessId(session);

  // 🔒 Plan Quota Enforcement
  const quotaCheck = await checkPlanQuota(businessId, "WAITER");
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      { error: quotaCheck.error || "Garson davet etme paket limitine ulaşıldı." },
      { status: 403 }
    );
  }
  
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
  const rawCode = generateInviteCode();
  
  // ✅ SECURITY: Store ONLY the hash in database
  const codeHash = hashInviteCode(rawCode);

  // ✅ P0-01 FIX: Mandatory expiry (7 days from now)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

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
      // ❌ Don't return businessId or inviteCode hash
    },
  });

  // ✅ SECURITY: Audit log — invite creation
  createAuditLog({
    businessId,
    actorUserId: session!.user.id,
    actorRole: session!.user.role,
    action: AuditActions.INVITE_CREATED,
    entityType: "WaiterInvite",
    entityId: invite.id,
  });

  return NextResponse.json(
    {
      message: "Davet kodu oluşturuldu",
      invite: {
        inviteCode: rawCode, // ✅ Raw code returned ONLY here, ONCE
        inviteUrl: buildInviteUrl(rawCode, request.nextUrl.origin),
        expiresAt: invite.expiresAt,
      },
    },
    { status: 201 }
  );
}
