#!/usr/bin/env node
// Salt-okunur, hız sınırlı tarama (yalnızca GET). Kullanım:
//   node maturity-audit/tests/crawl.mjs --base https://qr-menu-product.onrender.com --out maturity-audit/evidence/crawl.json
// Varsayılan: saniyede en fazla 1 istek, en fazla 60 sayfa, yalnızca aynı host.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), [])
);
const BASE = (args.base || "https://qr-menu-product.onrender.com").replace(/\/$/, "");
const OUT = args.out || "maturity-audit/evidence/crawl.json";
const MAX_PAGES = Number(args.max || 60);
const DELAY_MS = Number(args.delay || 1100);

const UAS = {
  googlebot_smartphone:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  oai_searchbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  chatgpt_user: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  claudebot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  claude_user: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  perplexitybot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  ccbot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  generic: "qr-menu-maturity-audit/1.0 (read-only; owner-authorized)",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requestCount = 0;

async function get(url, ua = UAS.googlebot_smartphone) {
  await sleep(requestCount === 0 ? 0 : DELAY_MS);
  requestCount++;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": ua, accept: "text/html,*/*" } });
    const body = await res.text();
    return {
      url,
      status: res.status,
      ms: Math.round(performance.now() - t0),
      location: res.headers.get("location"),
      headers: Object.fromEntries(res.headers),
      body,
    };
  } catch (e) {
    return { url, status: 0, ms: Math.round(performance.now() - t0), error: String(e), headers: {}, body: "" };
  }
}

const pick = (re, s) => (s.match(re) || [])[1]?.trim() ?? null;
function analyzeHtml(body) {
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, body);
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i, body);
  const robotsMeta = pick(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i, body);
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i, body);
  const lang = pick(/<html[^>]+lang=["']([^"']*)/i, body);
  const hreflang = [...body.matchAll(/<link[^>]+hreflang=["']([^"']*)/gi)].map((m) => m[1]);
  const jsonLd = [...body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try { return JSON.parse(m[1]); } catch { return { _invalid: m[1].slice(0, 200) }; }
  });
  const links = [...body.matchAll(/<a[^>]+href=["']([^"'#]+)/gi)].map((m) => m[1]);
  const h1 = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, description, robotsMeta, canonical, lang, hreflang, jsonLd, links, h1, textLength: text.length, textHash: createHash("sha256").update(text).digest("hex").slice(0, 16) };
}

const result = { base: BASE, startedAt: new Date().toISOString(), coldStart: null, files: {}, pages: [], bots: [], determinism: [], notFound: null, variants: [] };

// 1) Soğuk başlangıç / ilk yanıt
const first = await get(BASE + "/api/health", UAS.generic);
result.coldStart = { status: first.status, ms: first.ms, body: first.body.slice(0, 300) };

// 2) Kök dosyalar
for (const p of ["/robots.txt", "/sitemap.xml", "/sitemap_index.xml", "/llms.txt", "/favicon.ico", "/manifest.json", "/.well-known/security.txt"]) {
  const r = await get(BASE + p, UAS.generic);
  result.files[p] = { status: r.status, ms: r.ms, contentType: r.headers["content-type"] ?? null, location: r.location, bodyStart: r.body.slice(0, 400) };
}

// 3) Sayfa taraması (Googlebot smartphone), aynı host
const seeds = ["/", "/auth/signin", "/auth/signup", "/auth/register"];
const queue = [...seeds];
const seen = new Set();
while (queue.length && result.pages.length < MAX_PAGES) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const r = await get(BASE + path);
  const html = (r.headers["content-type"] || "").includes("text/html") ? analyzeHtml(r.body) : null;
  const { body, ...rest } = r;
  result.pages.push({ path, ...rest, html: html && { ...html, links: undefined, linkCount: html.links.length } });
  if (r.status >= 300 && r.status < 400 && r.location) {
    const loc = new URL(r.location, BASE);
    if (loc.origin === BASE && !seen.has(loc.pathname + loc.search)) queue.push(loc.pathname + loc.search);
  }
  for (const href of html?.links ?? []) {
    try {
      const u = new URL(href, BASE + path);
      if (u.origin !== BASE) continue;
      const p = u.pathname + u.search;
      if (!seen.has(p) && !queue.includes(p) && !p.startsWith("/api/")) queue.push(p);
    } catch {}
  }
}

// 4) Bot user-agent erişimi (ana sayfa)
for (const [name, ua] of Object.entries(UAS)) {
  const r = await get(BASE + "/", ua);
  result.bots.push({ bot: name, status: r.status, ms: r.ms, textHash: r.status === 200 ? analyzeHtml(r.body).textHash : null, server: r.headers["server"] ?? null, cfRay: r.headers["cf-ray"] ?? null });
}

// 5) Determinizm: aynı sayfa 3 kez
for (let i = 0; i < 3; i++) {
  const r = await get(BASE + "/");
  const a = analyzeHtml(r.body);
  result.determinism.push({ i, status: r.status, textHash: a.textHash, textLength: a.textLength });
}

// 6) Soft 404 ve URL varyantları
const nf = await get(BASE + "/bu-sayfa-yok-" + Date.now());
result.notFound = { status: nf.status, robotsMeta: analyzeHtml(nf.body).robotsMeta, title: analyzeHtml(nf.body).title };
for (const p of ["/index.html", "//", "/?utm_source=audit", "/auth/signin/", "/AUTH/SIGNIN", "/menu/yok/1", "/qr/gecersiz-token"]) {
  const r = await get(BASE + p);
  const a = (r.headers["content-type"] || "").includes("text/html") ? analyzeHtml(r.body) : {};
  result.variants.push({ path: p, status: r.status, location: r.location, canonical: a.canonical ?? null, robotsMeta: a.robotsMeta ?? null, title: a.title ?? null });
}

result.requestCount = requestCount;
result.finishedAt = new Date().toISOString();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`OK ${requestCount} istek -> ${OUT}`);
