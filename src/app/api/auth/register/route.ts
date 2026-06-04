import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

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

    // ✅ Şifre minimum 8 karakter
    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter olmalıdır" },
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

    // ✅ E-posta daha önce kullanılmış mı? (normalize edilmiş değerle kontrol)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // ✅ Davet kodu kontrolü
    const invite = await prisma.waiterInvite.findUnique({
      where: { inviteCode },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Geçersiz davet kodu" },
        { status: 400 }
      );
    }

    // ✅ Davet kodu kullanılmış mı?
    if (invite.isUsed) {
      return NextResponse.json(
        { error: "Bu davet kodu daha önce kullanılmış" },
        { status: 400 }
      );
    }

    // ✅ Davet kodu süresi dolmuş mu?
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Bu davet kodunun süresi dolmuş. Lütfen yeni bir davet kodu isteyin." },
        { status: 400 }
      );
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Kullanıcı oluştur (normalize edilmiş e-posta ile)
    const user = await prisma.user.create({
      data: {
        businessId: invite.businessId,
        name: String(name).trim(),
        email,
        password: hashedPassword,
        phone: phone || null,
        role: UserRole.WAITER,
      },
    });

    // ✅ Davet kodunu kullanılmış olarak işaretle — usedByUserId de güncelleniyor
    await prisma.waiterInvite.update({
      where: { id: invite.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedByUserId: user.id,
      },
    });

    return NextResponse.json(
      {
        message: "Kayıt başarılı",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Kayıt hatası:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
