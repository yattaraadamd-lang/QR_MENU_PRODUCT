#!/usr/bin/env node
// Basit gizli anahtar taraması (CI'daki gitleaks'e ek, yerelde de çalışır). Değerleri yazdırmaz.
// Kullanım: node maturity-audit/tests/secret-scan.mjs [--history|--self-test]
//   varsayılan: takip edilen dosyalar;  --history: tüm git geçmişindeki eklenen satırlar
//   --self-test: taramanın kendi senaryoları (sahte değerlerle)
import { execFileSync } from "node:child_process";

const SECRET_NAMES = "NEXTAUTH_SECRET|SUPER_ADMIN_PASSWORD|IYZICO_SECRET_KEY|IYZICO_API_KEY|CUSTOMER_DEVICE_HMAC_SECRET";
// Yer tutucular (CHANGE_ME, "openssl rand ...", "gizli-...", "buraya-...", process.env) sayılmaz.
const NOT_PLACEHOLDER = "(?!\\[|your|<|\\$|changeme|change_me|openssl|gizli|bura|process\\.env)";

const PATTERNS = [
  ["postgres-url-with-password", /postgres(?:ql)?:\/\/[^:@/\s]+:(?!\[|password@|PASSWORD|YOUR)[^@/\s\[\]]{6,}@[^\s"'`]+/g],
  ["stripe-live-key", /sk_live_[0-9a-zA-Z]{10,}/g],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/g],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  // DATABASE_URL değerleri yukarıdaki postgres-url-with-password kalıbıyla yakalanır.
  // Tırnak içinde her karakter olabilir (parolalar); tırnaksız değer anahtar biçiminde aranır.
  ["env-secret-assignment", new RegExp(`\\b(?:${SECRET_NAMES})\\s*=\\s*(?:(["'])${NOT_PLACEHOLDER}[^"'\\s]{12,}\\1|${NOT_PLACEHOLDER}[A-Za-z0-9+/=_:.@?&-]{16,})`, "gi")],
];
const mask = (s) => s.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@").replace(/(=\s*["']?)[^\s"']+/, "$1***");

// Değer, adın altındaki satırda da olabilir: Markdown başlığı + kod bloğu, YAML'da çok satırlı değer
const SECRET_NAME = new RegExp(`\\b(${SECRET_NAMES})\\b`);
const VALUE_LOOKAHEAD_LINES = 3;

/** Satırın tamamı anahtar görünümlü mü: tek parça, uzun, en az iki karakter sınıfı (ENV_ADI değil) */
function looksLikeBareSecret(text) {
  if (!/^[A-Za-z0-9+/_=-]{24,}$/.test(text)) return false;
  return [/[a-z]/, /[A-Z]/, /[0-9]/].filter((re) => re.test(text)).length >= 2;
}

/**
 * @param {string[]} lines `git grep -n` çıktısı (dosya:satır:içerik) ya da `git log -p` satırları
 * @returns {Set<string>} maskelenmiş bulgular
 */
function scan(lines, history) {
  const hits = new Set();
  let awaiting = null; // { name, file, linesLeft }

  for (const line of lines) {
    if (history && !line.startsWith("+")) continue;
    const grepMatch = history ? null : line.match(/^(.*?):(\d+):(.*)$/);
    const file = grepMatch?.[1] ?? "";
    const location = grepMatch ? `  @ ${file}:${grepMatch[2]}` : "";
    const content = history ? line.slice(1) : (grepMatch?.[3] ?? line);

    for (const [name, re] of PATTERNS) {
      for (const m of content.matchAll(re)) hits.add(`${name}: ${mask(m[0])}${location}`);
    }

    if (awaiting && awaiting.file !== file) awaiting = null;
    if (awaiting) {
      if (looksLikeBareSecret(content.trim())) hits.add(`value-below-name: ${awaiting.name}=***${location}`);
      awaiting = --awaiting.linesLeft > 0 ? awaiting : null;
    }
    const named = content.match(SECRET_NAME);
    if (named) awaiting = { name: named[1], file, linesLeft: VALUE_LOOKAHEAD_LINES };
  }
  return hits;
}

if (process.argv.includes("--self-test")) {
  const fake = `Zx9${"aB3".repeat(12)}`;
  const cases = [
    ["başlık altındaki kod bloğu", ["a.md:1:### NEXTAUTH_SECRET", "a.md:2:```", `a.md:3:${fake}`, "a.md:4:```"], 1],
    ["aynı satırda atama", [`a.md:1:NEXTAUTH_SECRET=${fake}`], 1],
    ["tırnaklı süper admin parolası", [`a.md:1:SUPER_ADMIN_PASSWORD="${fake}!#"`], 1],
    ["yer tutucu", ["a.md:1:NEXTAUTH_SECRET=changeme-please-change-me"], 0],
    ["openssl komutu", ["a.md:1:### NEXTAUTH_SECRET", "a.md:2:```", "a.md:3:openssl rand -base64 32"], 0],
    ["ortam değişkeni listesi", ["a.md:1:NEXTAUTH_SECRET", "a.md:2:CUSTOMER_DEVICE_HMAC_SECRET", "a.md:3:DATABASE_URL_UNPOOLED"], 0],
    ["kaynak kod", ["a.ts:1:const s = process.env.NEXTAUTH_SECRET;", "a.ts:2:if (!s) throw new Error();"], 0],
    ["adın uzağındaki değer", ["a.md:1:NEXTAUTH_SECRET", "a.md:2:x", "a.md:3:x", "a.md:4:x", `a.md:5:${fake}`], 0],
    ["başka dosyadaki değer", ["a.md:1:NEXTAUTH_SECRET", `b.md:1:${fake}`], 0],
  ];
  let failed = 0;
  for (const [title, lines, expected] of cases) {
    const found = scan(lines, false);
    const output = [...found].join(" ");
    const ok = found.size === expected && !output.includes(fake);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}: ${title} (${found.size}/${expected})`);
  }
  process.exit(failed ? 1 : 0);
}

const history = process.argv.includes("--history");
const text = history
  ? execFileSync("git", ["log", "--all", "-p", "--no-color", "--no-textconv", "--no-ext-diff", "--",".", ":!package-lock.json"], { maxBuffer: 1 << 30 }).toString()
  : execFileSync("git", ["grep", "-nI", "", "--", ".", ":!package-lock.json"], { maxBuffer: 1 << 30 }).toString();

const hits = scan(text.split(/\r?\n/), history);
for (const h of hits) console.log(h);
console.error(`${hits.size} olası gizli değer (${history ? "git geçmişi" : "takip edilen dosyalar"}).`);
process.exit(hits.size ? 1 : 0);
