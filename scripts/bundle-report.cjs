#!/usr/bin/env node
/**
 * Paket raporu (FE-ITEM-3.9): `next build` sonrası her sayfanın ilk yük JS'si (gzip -9).
 *
 * Sayfa chunk'ları + ata layout'lar (/layout, /admin/layout, ...) + ortak rootMainFiles
 * toplanır; yalnız sayfa anahtarı ölçülürse layout chunk'ları kaçar. Bütçeyi aşan rota
 * varsa çıkış kodu 1. GITHUB_STEP_SUMMARY tanımlıysa tablo CI özetine de yazılır.
 *
 * Kullanım: node scripts/bundle-report.cjs [--budget-kb=200] [--top=12]
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const BUDGET_KB = arg("budget-kb", 200);
const TOP = arg("top", 12);

const nextDir = path.join(process.cwd(), ".next");
const read = (f) => JSON.parse(fs.readFileSync(path.join(nextDir, f), "utf8"));
const app = read("app-build-manifest.json");
const build = read("build-manifest.json");

const cache = new Map();
const size = (f) => {
  if (!cache.has(f)) {
    const p = path.join(nextDir, f);
    const buf = fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
    cache.set(f, { raw: buf.length, gz: zlib.gzipSync(buf, { level: 9 }).length });
  }
  return cache.get(f);
};
const isJs = (f) => f.endsWith(".js");
const sum = (files) => [...files].reduce((a, f) => a + size(f).gz, 0);
const kb = (n) => (n / 1024).toFixed(1);

const shared = new Set([...(build.rootMainFiles || []), ...(build.polyfillFiles || [])].filter(isJs));

const rows = [];
for (const [page, files] of Object.entries(app.pages)) {
  if (!page.endsWith("/page")) continue;
  const js = new Set(files.filter(isJs));
  const segs = page.split("/").slice(1, -1);
  for (let i = 0; i <= segs.length; i++) {
    const key = "/" + [...segs.slice(0, i), "layout"].join("/");
    (app.pages[key] || []).filter(isJs).forEach((f) => js.add(f));
  }
  shared.forEach((f) => js.add(f));
  const own = [...js].filter((f) => !shared.has(f));
  const route = page.replace(/\/page$/, "") || "/";
  rows.push({ route, total: sum(js), own: sum(own) });
}
rows.sort((a, b) => b.total - a.total);

const over = rows.filter((r) => r.total / 1024 > BUDGET_KB);
const lines = [
  `### İlk yük JS (gzip) — bütçe ${BUDGET_KB} KB`,
  "",
  `Ortak çekirdek (rootMain + polyfill): **${kb(sum(shared))} KB**`,
  "",
  "| Rota | Toplam KB | Sayfaya özel KB | |",
  "|---|---:|---:|---|",
  ...rows.map((r) => `| \`${r.route}\` | ${kb(r.total)} | ${kb(r.own)} | ${r.total / 1024 > BUDGET_KB ? "❌ bütçe aşıldı" : ""} |`),
  "",
  `<details><summary>En büyük ${TOP} chunk</summary>`,
  "",
  "| gzip KB | ham KB | Dosya |",
  "|---:|---:|---|",
];
const all = new Set();
Object.values(app.pages).forEach((files) => files.filter(isJs).forEach((f) => all.add(f)));
[...all]
  .map((f) => ({ f, ...size(f) }))
  .sort((a, b) => b.gz - a.gz)
  .slice(0, TOP)
  .forEach((c) => lines.push(`| ${kb(c.gz)} | ${kb(c.raw)} | \`${c.f}\` |`));
lines.push("", "</details>", "");

const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");

if (over.length) {
  console.error(`\n${over.length} rota ${BUDGET_KB} KB bütçesini aştı: ${over.map((r) => r.route).join(", ")}`);
  process.exit(1);
}
