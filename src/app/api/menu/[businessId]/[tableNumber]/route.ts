import { NextRequest, NextResponse } from "next/server";
import { getPublicMenu } from "@/lib/services/public-menu.service";

export const dynamic = "force-dynamic";

/** If-None-Match zayıf karşılaştırma (RFC 9110): W/ öneki yok sayılır; liste ve * desteklenir */
function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || bare(tag) === bare(etag));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; tableNumber: string }> }
) {
  try {
    const { businessId, tableNumber } = await context.params;
    // Sorgular servis içinde; menü sayfası da sunucuda aynı servisi kullanır
    const result = await getPublicMenu(businessId, tableNumber);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // ✅ PERF: Menü sayfası periyodik yenilemede If-None-Match gönderir; değişmediyse gövdesiz
    // 304 döner. Cache-Control next.config'den gelir (/api → no-store, private); önbelleği istemci tutar.
    if (etagMatches(request.headers.get("if-none-match"), result.etag)) {
      return new NextResponse(null, { status: 304, headers: { ETag: result.etag } });
    }

    return new NextResponse(result.body, {
      headers: { "Content-Type": "application/json", ETag: result.etag },
    });
  } catch (error) {
    console.error("Menü yükleme hatası:", error);
    return NextResponse.json({ error: "Menü yüklenirken bir hata oluştu" }, { status: 500 });
  }
}
