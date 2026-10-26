import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/unified-rate-limit";

export const dynamic = "force-dynamic";

/**
 * 🔒 CSP ihlal raporları (next.config.mjs → report-uri / report-to)
 *
 * Tarayıcılar iki biçimde gönderir:
 *   - application/csp-report   → { "csp-report": { "document-uri", "blocked-uri", ... } } (Firefox, Safari)
 *   - application/reports+json → [{ type: "csp-violation", body: { documentURL, blockedURL, ... } }] (Chromium)
 *
 * Uç herkese açık ve gövde saldırganın elinde: boyut ve IP başına sayı sınırlı, yalnız
 * birkaç alan kısaltılıp Render loglarına yazılır, veritabanına yazılmaz. URL'lerden
 * sorgu dizesi ve yoldaki gizli token'lar (QR token, davet kodu) atılır; script örneği
 * (sample) hiç alınmaz.
 */

const MAX_BODY_BYTES = 16 * 1024;
const REPORTS_PER_MINUTE = 20;
const MAX_REPORTS_PER_REQUEST = 10;
const SECRET_PATH_RE = /^\/(qr|auth\/join)\/[^/]+/;

type Raw = Record<string, unknown>;

interface Violation {
  directive: string | null;
  blocked: string | null;
  document: string | null;
  source: string | null;
  line: number | null;
  column: number | null;
  disposition: string | null;
}

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    // data:, blob: gibi şemalarda içerik kendisi veridir; yalnız şemayı tut
    if (url.origin === "null") return url.protocol;
    return `${url.origin}${url.pathname.replace(SECRET_PATH_RE, "/$1/[token]")}`.slice(0, 200);
  } catch {
    // "inline", "eval", "wasm-eval" gibi anahtar kelimeler
    return value.replace(/[^a-z-]/gi, "").slice(0, 20) || null;
  }
}

function sanitizeWord(value: unknown): string | null {
  return typeof value === "string" ? value.replace(/[^a-z-]/gi, "").slice(0, 40) || null : null;
}

function sanitizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fromLegacy(r: Raw): Violation {
  return {
    directive: sanitizeWord(r["effective-directive"] ?? r["violated-directive"]),
    blocked: sanitizeUrl(r["blocked-uri"]),
    document: sanitizeUrl(r["document-uri"]),
    source: sanitizeUrl(r["source-file"]),
    line: sanitizeNumber(r["line-number"]),
    column: sanitizeNumber(r["column-number"]),
    disposition: sanitizeWord(r["disposition"]),
  };
}

function fromReportingApi(b: Raw): Violation {
  return {
    directive: sanitizeWord(b.effectiveDirective),
    blocked: sanitizeUrl(b.blockedURL),
    document: sanitizeUrl(b.documentURL),
    source: sanitizeUrl(b.sourceFile),
    line: sanitizeNumber(b.lineNumber),
    column: sanitizeNumber(b.columnNumber),
    disposition: sanitizeWord(b.disposition),
  };
}

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseViolations(payload: unknown): Violation[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((r): r is Raw => isObject(r) && r.type === "csp-violation" && isObject(r.body))
      .slice(0, MAX_REPORTS_PER_REQUEST)
      .map((r) => fromReportingApi(r.body as Raw));
  }
  if (isObject(payload) && isObject(payload["csp-report"])) {
    return [fromLegacy(payload["csp-report"])];
  }
  return [];
}

// Tarayıcı rapor başarısız olsa da tekrar denemez; saldırgana da bilgi vermemek için
// sınır aşımı ve bozuk gövde dahil her durumda 204 dönülür (yalnız aşırı büyük gövde 413).
const noContent = () => new Response(null, { status: 204 });

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const rl = await checkRateLimit(`csp_report:${getClientIp(request)}`, {
    maxRequests: REPORTS_PER_MINUTE,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) return noContent();

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return noContent();
  }

  for (const violation of parseViolations(payload)) {
    console.warn("[CSP_VIOLATION]", JSON.stringify(violation));
  }
  return noContent();
}
