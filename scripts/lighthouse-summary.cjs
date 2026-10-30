#!/usr/bin/env node
/**
 * Lighthouse CI özeti (FE-ITEM-3.9): `lhci autorun` sonrası her rotanın temsilî (medyan)
 * koşusu. CI'da her satır bir ::notice ek açıklaması olur (iş logu açılmadan PR'da ve
 * herkese açık check-run API'sinde görünür) ve tablo iş özetine yazılır.
 *
 * Kullanım: node scripts/lighthouse-summary.cjs [.lighthouseci/reports]
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] ?? path.join(".lighthouseci", "reports");
const manifestPath = path.join(dir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.log("Lighthouse raporu yok (adım çalışmamış olabilir).");
  process.exit(0);
}

const runs = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const rows = runs
  .filter((r) => r.isRepresentativeRun)
  .map((r) => {
    const lhr = JSON.parse(fs.readFileSync(r.jsonPath, "utf8"));
    const audit = (id) => lhr.audits[id]?.displayValue ?? "-";
    const all = runs.filter((x) => x.url === r.url).map((x) => x.summary.performance);
    return {
      route: new URL(r.url).pathname,
      perf: r.summary.performance,
      perfRuns: all.join(", "),
      a11y: r.summary.accessibility,
      fcp: audit("first-contentful-paint"),
      lcp: audit("largest-contentful-paint"),
      tbt: audit("total-blocking-time"),
      cls: audit("cumulative-layout-shift"),
      bench: Math.round(lhr.environment?.benchmarkIndex ?? 0),
    };
  });

const fmt = (n) => (typeof n === "number" ? n.toFixed(2) : "-");
for (const r of rows) {
  const line = `perf ${fmt(r.perf)} (koşular ${r.perfRuns}) · a11y ${fmt(r.a11y)} · FCP ${r.fcp} · LCP ${r.lcp} · TBT ${r.tbt} · CLS ${r.cls} · CPU endeksi ${r.bench}`;
  console.log(process.env.GITHUB_ACTIONS ? `::notice title=Lighthouse ${r.route}::${line}` : `${r.route}  ${line}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [
    "### Lighthouse (mobil, 3 koşu medyanı)",
    "",
    "| Rota | Performans | Erişilebilirlik | FCP | LCP | TBT | CLS |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows.map((r) => `| \`${r.route}\` | ${fmt(r.perf)} | ${fmt(r.a11y)} | ${r.fcp} | ${r.lcp} | ${r.tbt} | ${r.cls} |`),
    "",
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + "\n");
}
