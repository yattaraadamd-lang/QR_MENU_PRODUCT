import { NextRequest, NextResponse } from "next/server";
import { requireWaiter } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, response, session } = await requireWaiter();

    if (error || !session || !session.user?.id) {
      return (
        response ||
        NextResponse.json(
          { success: false, error: "Yetkisiz erişim" },
          { status: 401 }
        )
      );
    }

    // Garson kesinlikle doğrudan PAID yapamaz!
    return NextResponse.json(
      {
        success: false,
        error: "Garsonlar ödemeyi doğrudan tamamlayamaz. Lütfen ödeme bilgisini admin onayına gönderin.",
        code: "WAITER_DIRECT_PAYMENT_FORBIDDEN",
      },
      { status: 403 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "İşlem reddedildi.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
}
