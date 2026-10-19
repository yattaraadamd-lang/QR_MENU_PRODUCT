#!/usr/bin/env node
// /api/customer/* girdi fuzz testi — yalnız staging/yerel hedef.
// Her uç için alanlar tek tek yanlış tip, çok uzun metin, unicode/NUL ve enjeksiyon kalıplarıyla
// değiştirilir; ayrıca bozuk JSON gövdeleri ve başlık/sorgu değerleri denenir.
// Beklenti: hiçbir yanıt 5xx değil, gövdede stack trace / Prisma mesajı / dosya yolu yok,
// /api yanıtları JSON, her yanıt 10 sn içinde.
//
//   BASE_URL=https://qr-menu-platform-staging.onrender.com node maturity-audit/tests/fuzz-customer.mjs
//   Ayarlar: FUZZ_BUSINESS_ID=demo-business-id FUZZ_TABLE_NUMBER=3 FUZZ_DELAY_MS=60
//
// Veritabanına yazma en aza indirildi: sipariş/ödeme denemeleri ya geçersiz ürünle ya da
// oturumla eşleşmeyen masa ile yapılır; yalnız demo masasında birkaç VIEW_ONLY oturum oluşur.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStagingTarget, leaksInternals, warmUp } from "./lib/staging-target.mjs";

const { base } = resolveStagingTarget();
const BUSINESS_ID = process.env.FUZZ_BUSINESS_ID || "demo-business-id";
// Yük testleri 1, ratelimit.js 2 numaralı masayı kullanır; çakışmasın diye 3
const TABLE_NUMBER = process.env.FUZZ_TABLE_NUMBER || "3";
const DELAY_MS = Number(process.env.FUZZ_DELAY_MS || 60);
const TIMEOUT_MS = 10_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Fuzz değerleri ─────────────────────────────────────────────────────────
const WRONG_TYPES = [
  ["null", null],
  ["true", true],
  ["0", 0],
  ["-1", -1],
  ["1.5", 1.5],
  ["1e308", 1e308],
  ["boş dizi", []],
  ["dizi", ["a", 1, null]],
  ["boş nesne", {}],
  ["prisma not", { not: "" }],
  ["prisma contains", { contains: "" }],
  ["prisma in", { in: ["x"] }],
  ["mongo $ne", { $ne: null }],
  ["length taklidi", { length: 0 }],
];

const STRINGS = [
  ["boş", ""],
  ["boşluk", "   "],
  ["10k", "a".repeat(10_000)],
  ["100k", "b".repeat(100_000)],
  ["emoji", "😀🍕🇹🇷".repeat(500)],
  ["NUL", "\u0000"],
  ["NUL ortada", "abc\u0000def"],
  ["tek surrogate", "\ud800"],
  ["RTL override", "‮evil‬"],
  ["zalgo", "Z͓͔͑͒a͕͖l͗g͘o"],
  ["BOM+sıfır genişlik", "﻿​‍"],
  ["Türkçe", "İıŞşĞğÜüÖöÇç"],
  ["SQL", "' OR '1'='1' --"],
  ["SQL drop", "1; DROP TABLE \"Order\";--"],
  ["XSS", "<script>alert(1)</script>"],
  ["şablon", "{{7*7}}${7*7}<%= 7*7 %>"],
  ["yol", "../../../../etc/passwd"],
  ["CRLF", "x\r\nX-Injected: 1"],
  ["yüzde", "%00%0d%0a%25"],
];

const ALL_VALUES = [...WRONG_TYPES, ...STRINGS];

const RAW_BODIES = [
  ["boş gövde", "", "application/json"],
  ["yarım JSON", "{", "application/json"],
  ["yarım JSON 2", '{"businessId":', "application/json"],
  ["null", "null", "application/json"],
  ["dizi", "[]", "application/json"],
  ["metin", '"x"', "application/json"],
  ["sayı", "123", "application/json"],
  ["true", "true", "application/json"],
  ["prototip kirletme", '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}', "application/json"],
  ["tekrarlı anahtar", '{"businessId":"a","businessId":{"not":""}}', "application/json"],
  ["derin iç içe", "[".repeat(5000) + "]".repeat(5000), "application/json"],
  ["1MB", JSON.stringify({ note: "c".repeat(1_000_000) }), "application/json"],
  ["text/plain", "merhaba", "text/plain"],
  ["form", "businessId=a&tableId=b", "application/x-www-form-urlencoded"],
];

// Başlıklar yalnız Latin-1 taşıyabilir; unicode değerler burada denenmez
const HEADER_VALUES = [
  ["boş", ""],
  ["boşluk", " "],
  ["8k", "a".repeat(8_000)],
  ["SQL", "' OR '1'='1"],
  ["yol", "../../etc/passwd"],
  ["sahte biçim", "cs_" + "0".repeat(64)],
  ["JSON", '{"not":""}'],
];

// ─── İstek ve sonuç kaydı ───────────────────────────────────────────────────
const results = [];

async function send(endpoint, label, { method = "POST", body, rawBody, contentType = "application/json", headers = {}, query = "" } = {}) {
  const url = `${base}${endpoint}${query}`;
  const init = { method, redirect: "manual", headers: { ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (rawBody !== undefined) {
    init.body = rawBody;
    init.headers["Content-Type"] = contentType;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["Content-Type"] = "application/json";
  }

  const t0 = Date.now();
  let status = 0;
  let text = "";
  let ctype = "";
  let error = null;
  let res = null;
  try {
    res = await fetch(url, init);
    status = res.status;
    ctype = res.headers.get("content-type") || "";
    text = await res.text();
  } catch (e) {
    error = e.name === "TimeoutError" ? `zaman aşımı (${TIMEOUT_MS} ms)` : `${e.name}: ${e.message}`;
  }
  const ms = Date.now() - t0;

  const issues = [];
  if (error) issues.push(error);
  if (status >= 500) issues.push(`HTTP ${status}`);
  const leak = leaksInternals(text);
  if (leak) issues.push(`iç ayrıntı sızıntısı ${leak}`);
  if (status && status !== 204 && status < 300 && !/json/.test(ctype)) issues.push(`JSON olmayan yanıt (${ctype || "content-type yok"})`);

  results.push({ endpoint: `${method} ${endpoint}`, label, status, ms, issues, sample: issues.length ? text.slice(0, 300) : undefined });
  await sleep(DELAY_MS);
  return { res, status, text };
}

function setField(obj, dotted, value) {
  const copy = structuredClone(obj);
  const parts = dotted.split(".");
  let cur = copy;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts.at(-1)] = value;
  return copy;
}

// ─── Demo oturumu (cihaz çerezi elle taşınır) ───────────────────────────────
let deviceCookie = null;

async function openSession(tableId, { withCookie = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (withCookie && deviceCookie) headers.Cookie = deviceCookie;
  const res = await fetch(`${base}/api/customer/session`, {
    method: "POST",
    redirect: "manual",
    headers,
    body: JSON.stringify({ businessId: BUSINESS_ID, tableId }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const setCookie = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith("customer_device_id="));
  if (withCookie && setCookie && !deviceCookie) deviceCookie = setCookie.split(";")[0];
  const json = await res.json().catch(() => ({}));
  return { token: json.sessionToken || null, auth: json.authorizationStatus || null };
}

// ─── Senaryolar ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`Hedef: ${base}`);
  await warmUp(base);

  const menuRes = await fetch(`${base}/api/menu/${BUSINESS_ID}/${TABLE_NUMBER}`, { redirect: "manual" });
  const menu = await menuRes.json().catch(() => ({}));
  const tableId = menu?.table?.id;
  if (!tableId) {
    console.error(`Masa bulunamadı: /api/menu/${BUSINESS_ID}/${TABLE_NUMBER} → ${menuRes.status}. Staging seed edildi mi?`);
    process.exit(2);
  }

  const primary = await openSession(tableId);
  console.log(`Demo oturumu: ${primary.auth ?? "yok"}${primary.auth !== "AUTHORIZED" ? " (yetkili sipariş fuzz'ı atlanacak — başka masa: FUZZ_TABLE_NUMBER=4)" : ""}`);
  const authHeaders = primary.token ? { "x-session-token": primary.token } : {};

  // 1) POST /api/customer/session — kimliksiz
  {
    const ep = "/api/customer/session";
    const baseBody = { businessId: BUSINESS_ID, tableId, qrToken: "fuzz", existingToken: "fuzz" };
    for (const field of ["businessId", "tableId", "qrToken", "existingToken"]) {
      for (const [label, value] of ALL_VALUES) await send(ep, `${field}=${label}`, { body: setField(baseBody, field, value) });
    }
    for (const [label, raw, ct] of RAW_BODIES) await send(ep, `gövde: ${label}`, { rawBody: raw, contentType: ct });
  }

  // 2) GET /api/customer/session ve /session/status — başlık
  for (const ep of ["/api/customer/session", "/api/customer/session/status"]) {
    for (const [label, value] of HEADER_VALUES) await send(ep, `x-session-token=${label}`, { method: "GET", headers: { "x-session-token": value } });
  }

  // 3) GET /api/customer/active-requests — sorgu + başlık
  {
    const ep = "/api/customer/active-requests";
    for (const field of ["tableId", "businessId"]) {
      for (const [label, value] of STRINGS) {
        const q = new URLSearchParams({ tableId, businessId: BUSINESS_ID });
        q.set(field, value);
        await send(ep, `${field}=${label}`, { method: "GET", query: `?${q}`, headers: authHeaders });
      }
    }
    await send(ep, "tekrarlı parametre", { method: "GET", query: `?tableId=${tableId}&tableId[not]=x&businessId=${BUSINESS_ID}&businessId=y` });
    for (const [label, value] of HEADER_VALUES) {
      await send(ep, `x-session-token=${label}`, { method: "GET", query: `?tableId=${tableId}&businessId=${BUSINESS_ID}`, headers: { "x-session-token": value } });
    }
  }

  // 4) POST /api/customer/orders — oturumsuz (gövde doğrulaması oturumdan önce çalışır)
  {
    const ep = "/api/customer/orders";
    const baseBody = { items: [{ productId: "fuzz-olmayan-urun", quantity: 1 }], note: "", idempotencyKey: "fuzz-idem-0001" };
    for (const field of ["items", "note", "idempotencyKey"]) {
      for (const [label, value] of ALL_VALUES) await send(ep, `oturumsuz ${field}=${label}`, { body: setField(baseBody, field, value) });
    }
    for (const [label, raw, ct] of RAW_BODIES) await send(ep, `oturumsuz gövde: ${label}`, { rawBody: raw, contentType: ct });
  }

  // 5) POST /api/customer/orders — yetkili oturumla, derin alanlar.
  // Limit oturum token'ı başına 10 sn'de 1; her denemeden önce aynı cihazla token yenilenir.
  // Ürün id'si hep geçersiz olduğundan sipariş yazılmaz.
  if (primary.auth === "AUTHORIZED") {
    const ep = "/api/customer/orders";
    const baseBody = { items: [{ productId: "fuzz-olmayan-urun", quantity: 1, customerNote: "" }], idempotencyKey: "fuzz-idem-0001" };
    const fields = ["items.0.productId", "items.0.quantity", "items.0.customerNote", "idempotencyKey", "items.0"];
    for (const field of fields) {
      for (const [label, value] of ALL_VALUES) {
        const fresh = await openSession(tableId);
        if (fresh.auth !== "AUTHORIZED" || !fresh.token) {
          results.push({ endpoint: `POST ${ep}`, label: `yetkili ${field}=${label}`, status: 0, ms: 0, issues: [], skipped: "yetkili token alınamadı" });
          continue;
        }
        await send(ep, `yetkili ${field}=${label}`, { body: setField(baseBody, field, value), headers: { "x-session-token": fresh.token } });
      }
    }
    for (const [label, raw, ct] of RAW_BODIES) {
      const fresh = await openSession(tableId);
      await send(ep, `yetkili gövde: ${label}`, { rawBody: raw, contentType: ct, headers: fresh.token ? { "x-session-token": fresh.token } : {} });
    }
  }

  // 6) POST /api/customer/service-requests — not/sebep/tür doğrulaması oturumdan önce çalışır;
  // masa id'si oturumla eşleşmediği için talep yazılmaz (403'te durur).
  {
    const ep = "/api/customer/service-requests";
    const baseBody = { businessId: BUSINESS_ID, tableId: "fuzz-eslesmeyen-masa", requestType: "CALL_WAITER", note: "", reason: "", idempotencyKey: "fuzz-idem-0001", items: [] };
    for (const field of ["businessId", "tableId", "requestType", "note", "reason", "idempotencyKey", "items"]) {
      for (const [label, value] of ALL_VALUES) await send(ep, `${field}=${label}`, { body: setField(baseBody, field, value), headers: authHeaders });
    }
    for (const [label, raw, ct] of RAW_BODIES) await send(ep, `gövde: ${label}`, { rawBody: raw, contentType: ct, headers: authHeaders });
  }

  // 7) POST /api/customer/payment-requests — eşleşmeyen masa: ödeme talebi yazılmaz
  {
    const ep = "/api/customer/payment-requests";
    const baseBody = { businessId: BUSINESS_ID, tableId: "fuzz-eslesmeyen-masa", note: "" };
    for (const field of ["businessId", "tableId", "note"]) {
      for (const [label, value] of ALL_VALUES) await send(ep, `${field}=${label}`, { body: setField(baseBody, field, value), headers: authHeaders });
    }
    for (const [label, raw, ct] of RAW_BODIES) await send(ep, `gövde: ${label}`, { rawBody: raw, contentType: ct, headers: authHeaders });
  }

  report();
}

function report() {
  const ran = results.filter((r) => !r.skipped);
  const failed = ran.filter((r) => r.issues.length > 0);
  const byEndpoint = {};
  for (const r of ran) {
    const e = (byEndpoint[r.endpoint] ||= { toplam: 0, hatali: 0, durumlar: {} });
    e.toplam++;
    if (r.issues.length) e.hatali++;
    e.durumlar[r.status] = (e.durumlar[r.status] || 0) + 1;
  }

  console.log("\n=== Uç bazında özet ===");
  for (const [ep, s] of Object.entries(byEndpoint)) {
    console.log(`${ep}: ${s.toplam} deneme, ${s.hatali} hatalı, durumlar ${JSON.stringify(s.durumlar)}`);
  }
  const skipped = results.length - ran.length;
  if (skipped) console.log(`Atlanan: ${skipped}`);

  if (failed.length) {
    console.log(`\n=== ${failed.length} HATALI YANIT ===`);
    for (const f of failed) console.log(`- ${f.endpoint} [${f.label}] → ${f.status || "-"}: ${f.issues.join("; ")}`);
  } else {
    console.log("\nHatalı yanıt yok: 5xx, sızıntı ya da zaman aşımı görülmedi.");
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(here, "..", "evidence", "load-fuzz");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `fuzz-customer-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ base, at: new Date().toISOString(), byEndpoint, failed, total: results.length }, null, 2));
  console.log(`\nAyrıntı: ${path.relative(process.cwd(), outFile)}`);

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(2);
});
