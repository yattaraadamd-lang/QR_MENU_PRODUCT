import { prisma } from "@/lib/prisma";

/**
 * Landing "Müşteri Demo" bağlantısı: demo işletmesinin ilk açılan aktif masasına yönlendirir.
 * Sabit `/menu/demo-business-id/1` canlıda 1 numaralı masa silindiği için hata ekranına düşüyordu.
 */
const DEMO_BUSINESS_ID = process.env.DEMO_BUSINESS_ID || "demo-business-id";

export const dynamic = "force-dynamic";

function redirect(location: string) {
  // Göreli Location: proxy arkasında iç host adı bağlantıya sızmaz
  return new Response(null, { status: 307, headers: { Location: location, "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const table = await prisma.table.findFirst({
      where: { businessId: DEMO_BUSINESS_ID, isDeleted: false, isActive: true, business: { isActive: true } },
      orderBy: { createdAt: "asc" },
      select: { tableNumber: true },
    });
    if (table) return redirect(`/menu/${DEMO_BUSINESS_ID}/${encodeURIComponent(table.tableNumber)}`);
  } catch {
    // Veritabanına ulaşılamazsa landing'e dön; menü sayfası zaten hata ekranı gösterirdi
  }
  return redirect("/");
}
