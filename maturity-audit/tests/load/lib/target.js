// Ortak k6 yardımcıları: hedef doğrulama + ortak ayarlar.
//
// 🔒 Bu betikler YALNIZ staging/yerel hedefe çalışır. Canlı host her koşulda reddedilir;
// ortam değişkeniyle bu kontrol kapatılamaz. Yönlendirmeler izlenmez (maxRedirects: 0),
// böylece staging başka bir hosta yönlendirse bile istek oraya gitmez.

const PROD_HOSTS = ["qr-menu-product.onrender.com"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function parseHost(url) {
  // "https://staging@canli-host" gibi kullanıcı bilgisi içeren adresler reddedilir (host'u gizler)
  const authority = /^https?:\/\/([^/?#]*)/i.exec(url || "");
  if (!authority || authority[1].includes("@")) return null;
  const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#@]+)(?::(\d+))?(?:[/?#]|$)/i.exec(url || "");
  if (!m) return null;
  return { protocol: m[1].toLowerCase(), host: m[2].toLowerCase().replace(/\.$/, "") };
}

export function resolveTarget() {
  const raw = (__ENV.BASE_URL || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("BASE_URL gerekli. Örn: k6 run -e BASE_URL=https://qr-menu-platform-staging.onrender.com ...");
  }
  const parsed = parseHost(raw);
  if (!parsed) throw new Error(`BASE_URL çözümlenemedi: ${raw}`);
  const { host } = parsed;

  if (PROD_HOSTS.some((p) => host === p || host.endsWith("." + p))) {
    throw new Error(`REDDEDİLDİ: ${host} canlı host. Yük/fuzz testleri yalnız staging'e çalıştırılır.`);
  }
  const isLocal = LOCAL_HOSTS.includes(host) || host.endsWith(".localhost");
  const isStaging = host.includes("staging");
  if (!isLocal && !isStaging) {
    throw new Error(`REDDEDİLDİ: ${host} staging gibi görünmüyor (adında "staging" geçmeli ya da localhost olmalı).`);
  }
  return raw;
}

export const BASE_URL = resolveTarget();

// Demo işletmesi (prisma/seed.ts). Staging'de başka bir işletmeyle denemek için -e BUSINESS_ID=... -e TABLE_NUMBER=...
export const BUSINESS_ID = __ENV.BUSINESS_ID || "demo-business-id";
export const TABLE_NUMBER = __ENV.TABLE_NUMBER || "1";

export const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// Tüm senaryolarda ortak: yönlendirme izlenmez, TLS doğrulanır
export const COMMON_OPTIONS = {
  maxRedirects: 0,
  insecureSkipTLSVerify: false,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// Yanıt gövdesinde iç hata ayrıntısı sızıyor mu? (stack trace, Prisma mesajı, dosya yolu)
const LEAK_PATTERNS = [
  /\n\s+at [^\n]+\(/,
  /node_modules/,
  /Invalid `prisma\./,
  /PrismaClient\w*Error/,
  /\/opt\/render\//,
  /webpack-internal:/,
  /\.tsx?:\d+:\d+/,
];

export function leaksInternals(body) {
  if (typeof body !== "string" || body.length === 0) return false;
  return LEAK_PATTERNS.some((re) => re.test(body));
}
