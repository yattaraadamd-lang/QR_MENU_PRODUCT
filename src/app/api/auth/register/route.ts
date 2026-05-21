import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, inviteCode } = body;

    // Validasyon
    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Tüm alanlar zorunludur" },
        { status: 400 }
      );
    }

    // E-posta kontrolü
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Davet kodu kontrolü
    const invite = await prisma.waiterInvite.findUnique({
      where: { inviteCode },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Geçersiz davet kodu" },
        { status: 400 }
      );
    }

    if (invite.isUsed) {
      return NextResponse.json(
        { error: "Bu davet kodu daha önce kullanılmış" },
        { status: 400 }
      );
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Kullanıcı oluştur
    const user = await prisma.user.create({
      data: {
        businessId: invite.businessId,
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: UserRole.WAITER,
      },
    });

    // Davet kodunu kullanılmış olarak işaretle
    await prisma.waiterInvite.update({
      where: { id: invite.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
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
