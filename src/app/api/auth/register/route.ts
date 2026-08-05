import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * 🔒 SECURITY FIX P0-02: Atomic invite consumption + strengthened validation
 * 
 * CHANGES:
 * - Transaction-based atomic invite consumption (race condition fix)
 * - Strengthened password policy (12+ chars, common password check)
 * - Email === password validation
 * - bcrypt max length check (72 chars)
 * - Generic error messages (email enumeration prevention)
 * - Mandatory expiry validation
 * - Rate limiting TODO (needs Redis)
 */

// ✅ Geçici/sahte mail servisleri engellendi
const BLOCKED_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "yopmail.com",
  "fakeinbox.com",
  "trashmail.com",
  "throwam.com",
  "maildrop.cc",
  "dispostable.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "spam4.me",
  "discard.email",
];

// ✅ E-posta format regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, phone, inviteCode } = body;

    // ✅ E-postayı normalize et
    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

    // Temel alan kontrolü
    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Tüm alanlar zorunludur" },
        { status: 400 }
      );
    }

    // ✅ İsim uzunluğu
    if (String(name).trim().length < 2) {
      return NextResponse.json(
        { error: "İsim en az 2 karakter olmalıdır" },
        { status: 400 }
      );
    }

    // ✅ E-posta format kontrolü
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi giriniz" },
        { status: 400 }
      );
    }

    // ✅ Geçici/sahte domain kontrolü
    const domain = email.split("@")[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: "Geçici veya sahte e-posta adresleri kullanılamaz" },
        { status: 400 }
      );
    }

    // ✅ P0-02 FIX: Şifre minimum 12 karakter (strengthened from 8)
    if (String(password).length < 12) {
      return NextResponse.json(
        { error: "Şifre en az 12 karakter olmalıdır" },
        { status: 400 }
      );
    }

    // ✅ P0-02 FIX: Şifre maksimum 72 karakter (bcrypt limitation)
    if (String(password).length > 72) {
      return NextResponse.json(
        { error: "Şifre en fazla 72 karakter olabilir" },
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
    if (email.toLowerCase() === String(password).toLowerCase()) {
      return NextResponse.json(
        { error: "Şifre e-posta adresiniz ile aynı olamaz" },
        { status: 400 }
      );
    }

    // ✅ P0-02 FIX: Check common weak passwords
    const commonPasswords = [
      "123456789012", "password1234", "qwerty123456", "admin1234567",
      "welcome12345", "letmein12345", "monkey123456", "dragon123456",
      "master123456", "sunshine1234", "iloveyou1234", "princess1234",
    ];
    if (commonPasswords.includes(String(password).toLowerCase())) {
      return NextResponse.json(
        { error: "Bu şifre çok yaygın kullanılıyor. Lütfen daha güçlü bir şifre seçin." },
        { status: 400 }
      );
    }

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
      const consumeResult = await tx.waiterInvite.updateMany({
        where: {
          inviteCode,
          isUsed: false, // ✅ CRITICAL: Only consume if not used
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
          // Note: usedByUserId will be set after user creation
        },
      });

      // If updateMany affected 0 rows, invite was already used or doesn't exist
      if (consumeResult.count === 0) {
        // Fetch to determine exact reason
        const invite = await tx.waiterInvite.findUnique({
          where: { inviteCode },
        });

        if (!invite) {
          throw new Error("INVITE_NOT_FOUND");
        }
        if (invite.isUsed) {
          throw new Error("INVITE_ALREADY_USED");
        }
        // Should not reach here, but safety fallback
        throw new Error("INVITE_CONSUME_FAILED");
      }

      // 3. Now fetch the consumed invite to get businessId
      const invite = await tx.waiterInvite.findUnique({
        where: { inviteCode },
      });

      if (!invite) {
        throw new Error("INVITE_NOT_FOUND_AFTER_CONSUME");
      }

      // ✅ P0-02 FIX: Mandatory expiry check (invite.expiresAt is now required in creation)
      if (!invite.expiresAt || new Date() > invite.expiresAt) {
        // Rollback transaction - invite should not have been consumable
        throw new Error("INVITE_EXPIRED");
      }

      // 4. Hash password (bcrypt is sync-safe in transaction)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 5. Create user
      const user = await tx.user.create({
        data: {
          businessId: invite.businessId,
          name: String(name).trim(),
          email,
          password: hashedPassword,
          phone: phone || null,
          role: UserRole.WAITER,
        },
      });

      // 6. Update invite with user ID
      await tx.waiterInvite.update({
        where: { id: invite.id },
        data: {
          usedByUserId: user.id,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    }, {
      maxWait: 5000, // Max time to wait for transaction slot
      timeout: 10000, // Max transaction execution time
    });

    // ✅ TODO: Audit log (outside transaction for performance)
    // await createAuditLog({
    //   action: "USER_REGISTERED",
    //   entityType: "User",
    //   entityId: result.id,
    //   inviteCode: inviteCode,
    // });

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
      return NextResponse.json(
        { error: "Kayıt işlemi tamamlanamadı. Lütfen bilgilerinizi kontrol edin." },
        { status: 400 }
      );
    }

    if (errorMessage === "INVITE_NOT_FOUND" || errorMessage === "INVITE_CONSUME_FAILED") {
      return NextResponse.json(
        { error: "Geçersiz davet kodu" },
        { status: 400 }
      );
    }

    if (errorMessage === "INVITE_ALREADY_USED") {
      return NextResponse.json(
        { error: "Bu davet kodu daha önce kullanılmış" },
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
