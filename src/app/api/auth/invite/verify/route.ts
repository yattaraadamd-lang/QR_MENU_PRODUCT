import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashInviteCode, extractInviteCode } from "@/lib/invite";
import { rateLimit, getClientIp, UNIFIED_RATE_LIMITS, createRateLimitResponse } from "@/lib/unified-rate-limit";
import { inviteVerifySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/auth/invite/verify — Davet linki açıldığında işletme adını ve geçerliliği döndürür.
// Kod gövdede gelir (URL query'de değil). Davet TÜKETİLMEZ; tüketim /api/auth/register'da olur.
export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit({ ...UNIFIED_RATE_LIMITS.GENERAL, identifier: `invite_verify_${getClientIp(request)}` });
    if (!rl.success) return createRateLimitResponse(rl);

    // null / dizi / bozuk gövde body.code erişiminde TypeError atıp 500 dönüyordu; davet
    // sayfası { valid, reason } beklediği için hata zarfı yerine aynı INVALID yanıtı döner
    const parsed = inviteVerifySchema.safeParse(await request.json().catch(() => null));
    const code = parsed.success ? extractInviteCode(parsed.data.code) : "";
    if (!code || code.length > 200) {
      return NextResponse.json({ valid: false, reason: "INVALID" }, { status: 400 });
    }

    const invite = await prisma.waiterInvite.findUnique({
      where: { inviteCode: hashInviteCode(code) },
      select: {
        isUsed: true,
        expiresAt: true,
        business: { select: { name: true, logo: true, isActive: true } },
      },
    });

    if (!invite || !invite.business.isActive) {
      return NextResponse.json({ valid: false, reason: "INVALID" });
    }
    if (invite.isUsed) {
      return NextResponse.json({ valid: false, reason: "USED" });
    }
    if (!invite.expiresAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: "EXPIRED" });
    }

    return NextResponse.json({
      valid: true,
      businessName: invite.business.name,
      businessLogo: invite.business.logo,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error("[INVITE_VERIFY_ERROR]", { message: (error as any)?.message });
    return NextResponse.json({ valid: false, reason: "ERROR" }, { status: 500 });
  }
}
