#!/usr/bin/env node
// SEO regresyon kontrolü (build gerektirmez): robots/sitemap rotaları ve noindex düzenleri
// silinirse ya da hassas yollar robots.txt'den çıkarılırsa CI kırmızıya döner.
// Kullanım: node maturity-audit/tests/seo-static.mjs
import { existsSync, readFileSync } from "node:fs";

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

const robots = read("src/app/robots.ts");
check("src/app/robots.ts var", !!robots);
for (const path of ["/api/", "/qr/", "/admin", "/waiter", "/super-admin"]) {
  check(`robots.txt ${path} yolunu kapatıyor`, robots.includes(`"${path}"`));
}
check("robots.txt sitemap'i gösteriyor", /sitemap:\s*`\$\{SITE_URL\}\/sitemap\.xml`/.test(robots));

const sitemap = read("src/app/sitemap.ts");
check("src/app/sitemap.ts var", !!sitemap);
for (const bad of ["/auth", "/menu", "/qr", "/admin", "/waiter"]) {
  check(`sitemap ${bad} içermiyor`, !sitemap.includes(bad));
}

for (const [file, follow] of [["src/app/auth/layout.tsx", true], ["src/app/menu/layout.tsx", false], ["src/app/qr/layout.tsx", false]]) {
  const src = read(file);
  check(`${file} noindex`, /robots:\s*\{\s*index:\s*false/.test(src), follow ? "follow: true beklenir" : "");
}

const layout = read("src/app/layout.tsx");
check("kök layout metadataBase tanımlı", layout.includes("metadataBase"));
check("kök layout self-canonical", /alternates:\s*\{\s*canonical:\s*"\.\/"/.test(layout));
check("kök layout başlık şablonu", layout.includes("template:"));

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}${c.detail && !c.ok ? " (" + c.detail + ")" : ""}`);
}
console.error(`\n${checks.length} kontrol, ${failed} başarısız.`);
process.exit(failed ? 1 : 0);
