import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/unified-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Web Vitals (components/WebVitals → sendBeacon). Gerçek kullanıcıların LCP/INP/CLS
 * değerleri Render loglarına "[WEB_VITAL]" satırı olarak düşer; veritabanına yazılmaz.
 *
 * Uç herkese açık ve gövde istemcinin elinde (csp-report ile aynı ilke): boyut ve IP başına
 * sayı sınırlı, alanlar beyaz listeden geçer, rota deseni dışındaki yol kısımları atılır.
 * Kafede herkes aynı IP'den çıkabildiği için sınır geniş; aşılırsa ölçüm sessizce düşer.
 */

const MAX_BODY_BYTES = 2 * 1024;
const METRICS_PER_MINUTE = 120;
const NAMES = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);
const SECRET_PATH_RE = /^\/(qr|auth\/join)\/[^/[]+/;

// Tarayıcı beacon'ı yeniden denemez; her durumda 204 (yalnız aşırı büyük gövde 413)
const noContent = () => new Response(null, { status: 204 });

function sanitizeRoute(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  return value.split("?")[0].replace(SECRET_PATH_RE, "/$1/[token]").replace(/[^\w/[\]-]/g, "").slice(0, 100);
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const rl = await checkRateLimit(`web_vitals:${getClientIp(request)}`, {
    maxRequests: METRICS_PER_MINUTE,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) return noContent();

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text);
  } catch {
    return noContent();
  }
  if (typeof payload !== "object" || payload === null) return noContent();

  const { name, value, rating, navigationType } = payload;
  const route = sanitizeRoute(payload.route);
  if (typeof name !== "string" || !NAMES.has(name)) return noContent();
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return noContent();
  if (!route) return noContent();

  console.info(
    "[WEB_VITAL]",
    JSON.stringify({
      name,
      // CLS birimsiz (4 hane), diğerleri ms
      value: name === "CLS" ? Math.round(value * 10000) / 10000 : Math.round(value),
      rating: typeof rating === "string" && RATINGS.has(rating) ? rating : null,
      navigationType: typeof navigationType === "string" ? navigationType.replace(/[^a-z-]/gi, "").slice(0, 20) : null,
      route,
    }),
  );
  return noContent();
}
