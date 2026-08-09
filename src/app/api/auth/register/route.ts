import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX P0-02: Atomic invite consumption + strengthened validation
 * 
 * CHANGES:
 * - Zod strict schema for all inputs
 * - Transaction-based atomic invite consumption (race condition fix)
 * - Invite code hash comparison (matches P0-01 hash storage)
 * - Strengthened password policy (12+ chars, common password check)
 * - Email === password validation
 * - bcrypt max length check (72 chars)
 * - Generic error messages (email enumeration prevention)
 * - Mandatory expiry validation
 */

// ✅ Geçici/sahte mail servisleri engellendi
const BLOCKED_DOMAINS = [
  "mailinator.com", "10minutemail.com", "tempmail.com",
  "guerrillamail.com", "yopmail.com", "fakeinbox.com",
  "trashmail.com", "throwam.com", "maildrop.cc",
  "dispostable.com", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "spam4.me", "discard.email",
];

// ✅ Common weak passwords (12+ chars)
const COMMON_PASSWORDS = [
  "123456789012", "password1234", "qwerty123456", "admin1234567",
  "welcome12345", "letmein12345", "monkey123456", "dragon123456",
  "master123456", "sunshine1234", "iloveyou1234", "princess1234",
  "password12345", "123456789abc", "abcdefgh1234",
];

// ✅ Zod strict schema
const registerSchema = z.object({
  name: z.string().trim().min(2, "İsim en az 2 karakter olmalıdır").max(100, "İsim en fazla 100 karakter olabilir"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz").max(255),
  password: z.string()
    .min(12, "Şifre en az 12 karakter olmalıdır")
    .max(72, "Şifre en fazla 72 karakter olabilir"),
  phone: z.string().max(20).optional().nullable(),
  inviteCode: z.string().min(1, "Davet kodu zorunludur").max(200),
}).strict(); // ✅ Reject unknown fields

/**
 * Hash an invite code for lookup (must match the hash used in creation).
 */
function hashInviteCode(rawCode: string): string {
  return crypto.createHash("sha256").update(rawCode).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // ✅ Zod strict validation
    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Geçersiz veri";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }
    
    const { name, password, phone, inviteCode } = parseResult.data;
    
    // ✅ Email normalization: trim + lowercase
    const email = parseResult.data.email.trim().toLowerCase();

    // ✅ Geçici/sahte domain kontrolü
    const domain = email.split("@")[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: "Geçici veya sahte e-posta adresleri kullanılamaz" },
        { status: 400 }
      );
    }

    // ✅ Şifre en az 1 harf + 1 rakam içermeli
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    if (!hasLetter || !hasDigit) {
      return NextResponse.json(
        { error: "Şifre en az 1 harf ve 1 rakam içermelidir" },
        { status: 400 }
      );
    }

    // ✅ P0-02 FIX: Email and password must not be the same
    if (email.toLowerCase() === password.toLowerCase()) {
      return NextResponse.json(
        { error: "Şifre e-posta adresiniz ile aynı olamaz" },
        { status: 400 }
      );
    }

    // ✅ P0-02 FIX: Check common weak passwords
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return NextResponse.json(
        { error: "Bu şifre çok yaygın kullanılıyor. Lütfen daha güçlü bir şifre seçin." },
        { status: 400 }
      );
    }

    // ✅ Hash the invite code for database lookup (matches P0-01 hash storage)
    const inviteCodeHash = hashInviteCode(inviteCode);

    // ✅ P0-02 FIX: Atomic transaction for invite consumption + user creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check email uniqueness (inside transaction)
      const existingUser = await tx.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error("EMAIL_EXISTS");
      }

      // 2. Atomic invite consumption - fetch + lock with conditional update
      // This prevents race condition: only ONE request will succeed
      // ✅ SECURITY: Compare against hashed invite code
      const consumeResult = await tx.waiterInvite.updateMany({
        where: {
          inviteCode: inviteCodeHash, // ✅ Hash comparison
          isUsed: false, // ✅ CRITICAL: Only consume if not used
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      // If updateMany affected 0 rows, invite was already used or doesn't exist
      if (consumeResult.count === 0) {
        // ✅ Generic error - don't reveal whether code exists or was used
        throw new Error("INVITE_INVALID");
      }

      // 3. Fetch the consumed invite to get businessId
      const invite = await tx.waiterInvite.findFirst({
        where: { inviteCode: inviteCodeHash },
      });

      if (!invite) {
        throw new Error("INVITE_INVALID");
      }

      // ✅ P0-02 FIX: Mandatory expiry check
      if (!invite.expiresAt || new Date() > invite.expiresAt) {
        // Rollback - expired invite should not be consumable
        throw new Error("INVITE_EXPIRED");
      }

      // 4. Hash password
      const hashedPassword = await bcrypt.hash(password, 12); // ✅ cost factor 12

      // 5. Create user
      const user = await tx.user.create({
        data: {
          businessId: invite.businessId,
          name: name.trim(),
          email,
          password: hashedPassword,
          phone: phone || null,
          role: UserRole.WAITER,
        },
      });

      // 6. Update invite with user ID
      await tx.waiterInvite.update({
        where: { id: invite.id },
        data: { usedByUserId: user.id },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        businessId: invite.businessId,
      };
    }, {
      maxWait: 5000,
      timeout: 10000,
    });

    // ✅ SECURITY: Audit log — user registration
    createAuditLog({
      businessId: result.businessId,
      actorUserId: result.id,
      actorRole: "WAITER",
      action: AuditActions.USER_REGISTERED,
      entityType: "User",
      entityId: result.id,
    });

    return NextResponse.json(
      {
        message: "Kayıt başarılı",
        user: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", {
      code: (error as any)?.code,
      message: (error as any)?.message,
      // ❌ DO NOT log email, password, or PII
    });

    // ✅ P0-02 FIX: Generic error messages to prevent enumeration
    const errorMessage = (error as any)?.message;

    if (errorMessage === "EMAIL_EXISTS") {
      // ✅ Generic: don't reveal that email exists
      return NextResponse.json(
        { error: "Kayıt işlemi tamamlanamadı. Lütfen bilgilerinizi kontrol edin." },
        { status: 400 }
      );
    }

    if (errorMessage === "INVITE_INVALID") {
      return NextResponse.json(
        { error: "Geçersiz veya kullanılmış davet kodu." },
        { status: 400 }
      );
    }

    if (errorMessage === "INVITE_EXPIRED") {
      return NextResponse.json(
        { error: "Bu davet kodunun süresi dolmuş. Lütfen yeni bir davet kodu isteyin." },
        { status: 400 }
      );
    }

    // Generic error for all other cases
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
