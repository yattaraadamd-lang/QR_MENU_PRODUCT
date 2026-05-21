import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// GET /api/admin/waiter-invites - Davet kodlarını listele
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const invites = await prisma.waiterInvite.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
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
    const body = await request.json();

    // Özel kod veya otomatik oluştur
    const inviteCode = body.inviteCode || `INV-${uuidv4().slice(0, 6).toUpperCase()}`;

    // Kod benzersizlik kontrolü
    const existing = await prisma.waiterInvite.findUnique({
      where: { inviteCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu davet kodu zaten kullanılıyor" },
        { status: 400 }
      );
    }

    const invite = await prisma.waiterInvite.create({
      data: {
        businessId,
        inviteCode,
        isUsed: false,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    return NextResponse.json(
      { message: "Davet kodu oluşturuldu", invite },
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
