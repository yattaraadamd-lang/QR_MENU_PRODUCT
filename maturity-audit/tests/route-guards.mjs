#!/usr/bin/env node
// Statik regresyon kontrolü: src/app/api altındaki her route.ts dosyası ya bir yetki
// koruması (require*/getServerSession/validateCustomerSession/imza doğrulaması) çağırmalı
// ya da aşağıdaki PUBLIC_ROUTES listesinde gerekçesiyle yer almalı.
// Kullanım: node maturity-audit/tests/route-guards.mjs [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "src", "app", "api");

// Bilerek herkese açık olan uç noktalar ve neden açık oldukları.
const PUBLIC_ROUTES = {
  "/api/health": "Render sağlık kontrolü",
  "/api/auth/[...nextauth]": "next-auth giriş akışı (kendi CSRF token'ı var)",
  "/api/auth/me": "oturum yoksa 401 döner",
  "/api/auth/register": "garson daveti ile kayıt (rate limit + davet kodu)",
  "/api/auth/signup": "self-servis işletme kaydı (rate limit)",
  "/api/auth/invite/verify": "davet kodu doğrulama (rate limit)",
  "/api/billing/iyzico/callback": "iyzico dönüş URL'i; token iyzico API'sinden doğrulanır",
  "/api/billing/iyzico/webhook": "iyzico webhook (HMAC imza)",
  "/api/qr/[qrToken]": "müşteri QR girişi (imzalı token)",
  "/api/menu/[businessId]/[tableNumber]": "müşteri menüsü (salt-okunur)",
  "/api/public/[businessSlug]/categories": "herkese açık menü kategorileri",
  "/api/business/[slug]": "herkese açık işletme bilgisi",
  "/api/customer/session": "müşteri oturumu açma (QR token + rate limit)",
  "/api/customer/session/status": "müşteri oturum durumu (cihaz çerezi)",
  "/api/customer/active-requests": "müşteri talepleri (cihaz çerezi)",
  "/api/customer/orders": "müşteri sipariş talebi (cihaz çerezi + rate limit)",
  "/api/customer/payment-requests": "müşteri ödeme talebi (cihaz çerezi + rate limit)",
  "/api/customer/service-requests": "müşteri garson çağırma (cihaz çerezi + rate limit)",
  "/api/tables/[tableId]/session": "kaldırıldı; her metot 410 döner",
};

const GUARD_RE =
  /\b(require(?:Auth|Admin|SuperAdmin|Waiter|WaiterOrAdmin|Role|Staff)\w*|getServerSession|getAuthUser\w*|validateCustomerSession\w*|verifyWebhookSignature|getCustomerSession\w*|requireCustomer\w*)\s*\(/;
const RATE_RE = /\b(checkRateLimit|rateLimit|withRateLimit|unifiedRateLimit|enforceRateLimit)\w*\s*\(/;
const METHOD_RE = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === "route.ts" ? [p] : [];
  });
}

const rows = walk(ROOT).map((file) => {
  const src = readFileSync(file, "utf8");
  const route = "/api/" + relative(ROOT, file).split(sep).slice(0, -1).join("/");
  const methods = [...src.matchAll(METHOD_RE)].map((m) => m[1]);
  const guarded = GUARD_RE.test(src);
  const rateLimited = RATE_RE.test(src);
  const publicReason = PUBLIC_ROUTES[route] ?? null;
  return { route, methods, guarded, rateLimited, publicReason, ok: guarded || !!publicReason };
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const r of rows) {
    const flag = r.ok ? "OK  " : "FAIL";
    console.log(`${flag} ${r.route.padEnd(58)} ${r.methods.join(",").padEnd(16)} guard=${r.guarded ? "y" : "n"} rl=${r.rateLimited ? "y" : "n"}${r.publicReason ? "  public: " + r.publicReason : ""}`);
  }
}
const failed = rows.filter((r) => !r.ok);
console.error(`\n${rows.length} route, ${failed.length} korumasız ve izin listesinde olmayan.`);
process.exit(failed.length ? 1 : 0);
