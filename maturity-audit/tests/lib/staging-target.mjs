// Node betikleri için hedef doğrulama (k6 tarafındaki load/lib/target.js ile aynı kurallar).
// 🔒 Canlı host her koşulda reddedilir; ortam değişkeniyle kapatılamaz.

const PROD_HOSTS = ["qr-menu-product.onrender.com"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

export function resolveStagingTarget(raw = process.env.BASE_URL) {
  const value = (raw || "").trim().replace(/\/+$/, "");
  if (!value) {
    throw new Error("BASE_URL gerekli. Örn: BASE_URL=https://qr-menu-platform-staging.onrender.com node ...");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`BASE_URL çözümlenemedi: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Desteklenmeyen protokol: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (PROD_HOSTS.some((p) => host === p || host.endsWith("." + p))) {
    throw new Error(`REDDEDİLDİ: ${host} canlı host. Yük/fuzz testleri yalnız staging'e çalıştırılır.`);
  }
  const isLocal = LOCAL_HOSTS.includes(host) || host.endsWith(".localhost");
  if (!isLocal && !host.includes("staging")) {
    throw new Error(`REDDEDİLDİ: ${host} staging gibi görünmüyor (adında "staging" geçmeli ya da localhost olmalı).`);
  }
  return { base: value, url, host, isLocal };
}

// Yanıtta iç hata ayrıntısı (stack trace, Prisma mesajı, dosya yolu) var mı?
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
  if (typeof body !== "string" || body.length === 0) return null;
  const hit = LEAK_PATTERNS.find((re) => re.test(body));
  return hit ? String(hit) : null;
}

// Render free planı uyuyorsa uyandır
export async function warmUp(base, maxSeconds = 120) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
      if (res.status === 200) return;
    } catch {
      /* tekrar dene */
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${base}/api/health ${maxSeconds} sn içinde 200 dönmedi — staging ayakta mı?`);
}
