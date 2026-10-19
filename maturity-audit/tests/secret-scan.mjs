#!/usr/bin/env node
// Basit gizli anahtar taraması (gitleaks yoksa yedek). Değerleri maskeleyerek yazdırır.
// Kullanım: node maturity-audit/tests/secret-scan.mjs [--history]
//   varsayılan: takip edilen dosyalar;  --history: tüm git geçmişindeki eklenen satırlar
import { execFileSync } from "node:child_process";

const PATTERNS = [
  ["postgres-url-with-password", /postgres(?:ql)?:\/\/[^:@/\s]+:(?!\[|password@|PASSWORD|YOUR)[^@/\s\[\]]{6,}@[^\s"'`]+/g],
  ["stripe-live-key", /sk_live_[0-9a-zA-Z]{10,}/g],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/g],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  // Yer tutucular (CHANGE_ME, "openssl rand ...", "gizli-...", "buraya-...", process.env) sayılmaz.
  // DATABASE_URL değerleri yukarıdaki postgres-url-with-password kalıbıyla yakalanır.
  ["env-secret-assignment", /\b(?:NEXTAUTH_SECRET|IYZICO_SECRET_KEY|IYZICO_API_KEY|CUSTOMER_DEVICE_HMAC_SECRET)\s*=\s*["']?(?!\[|your|<|\$|changeme|change_me|openssl|gizli|bura|process\.env)[A-Za-z0-9+/=_:.@?&-]{16,}/gi],
];
const mask = (s) => s.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@").replace(/(=\s*["']?.{4})[^\s"']+/, "$1***");

const history = process.argv.includes("--history");
const text = history
  ? execFileSync("git", ["log", "--all", "-p", "--no-color", "--no-textconv", "--no-ext-diff", "--",".", ":!package-lock.json"], { maxBuffer: 1 << 30 }).toString()
  : execFileSync("git", ["grep", "-nI", "", "--", ".", ":!package-lock.json"], { maxBuffer: 1 << 30 }).toString();

const hits = new Set();
for (const line of text.split("\n")) {
  if (history && !line.startsWith("+")) continue;
  for (const [name, re] of PATTERNS) {
    for (const m of line.matchAll(re)) hits.add(`${name}: ${mask(m[0])}${history ? "" : "  @ " + line.split(":").slice(0, 2).join(":")}`);
  }
}
for (const h of hits) console.log(h);
console.error(`${hits.size} olası gizli değer (${history ? "git geçmişi" : "takip edilen dosyalar"}).`);
process.exit(hits.size ? 1 : 0);
