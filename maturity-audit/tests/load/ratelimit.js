// 429 + Retry-After davranışı ve başlık sahteciliğiyle limit atlatma denemesi.
//   A) /api/auth/invite/verify (kimliksiz, IP başına 100/15 dk): limit dolunca 429 + Retry-After (1..900 sn),
//      JSON gövde, sonraki isteklerde de 429 (dalgalanma yok).
//   B) Limit dolduktan sonra sahte CF-Connecting-IP / X-Forwarded-For / X-Real-IP ile tekrar:
//      HÂLÂ 429 olmalı. 429 değilse → istemci IP'yi kendisi seçebiliyor = limit atlatılabilir (YÜKSEK).
//   C) /api/customer/orders (oturum başına 10 sn'de 1): ikinci istek 429 + Retry-After olmalı.
// Not: A ve B bu IP'nin staging'deki davet doğrulama hakkını 15 dk tüketir.
//   k6 run -e BASE_URL=https://qr-menu-platform-staging.onrender.com maturity-audit/tests/load/ratelimit.js
import http from "k6/http";
import { check, group } from "k6";
import { BASE_URL, BUSINESS_ID, COMMON_OPTIONS, leaksInternals } from "./lib/target.js";
import { warmUp } from "./lib/warmup.js";

const EXPECTED = http.expectedStatuses(200, 201, 400, 401, 403, 404, 409, 429);
const MAX_PROBES = Number(__ENV.MAX_PROBES || 140);
const RL_TABLE = __ENV.RL_TABLE_NUMBER || "2";

export const options = {
  ...COMMON_OPTIONS,
  scenarios: { probe: { executor: "shared-iterations", vus: 1, iterations: 1, maxDuration: "5m" } },
  thresholds: {
    "checks{part:A}": ["rate==1"],
    "checks{part:B}": ["rate==1"],
    "checks{part:C}": ["rate==1"],
  },
};

export function setup() {
  return warmUp();
}

function retryAfterValid(res, maxSeconds) {
  const v = res.headers["Retry-After"];
  if (!v || !/^\d+$/.test(v)) return false;
  const n = Number(v);
  return n >= 1 && n <= maxSeconds;
}

function randomOctet() {
  return 1 + Math.floor(Math.random() * 253);
}

export default function () {
  const url = `${BASE_URL}/api/auth/invite/verify`;
  const body = JSON.stringify({ code: "ratelimit-probe-gecersiz-kod" });
  const params = { headers: { "Content-Type": "application/json" }, responseCallback: EXPECTED, tags: { name: "invite_verify" } };

  let first429 = null;
  let sentBefore429 = 0;

  group("A: davet doğrulama limiti", () => {
    for (let i = 0; i < MAX_PROBES; i++) {
      const res = http.post(url, body, params);
      if (res.status === 429) {
        first429 = res;
        break;
      }
      sentBefore429++;
      check(res, { "limit dolmadan 5xx yok": (r) => r.status < 500 }, { part: "A" });
    }
    console.log(`A: ${sentBefore429} istekten sonra ilk 429 (beklenen: en fazla 100; önceki çalıştırmalar hakkı azaltmış olabilir)`);

    check(first429, {
      "A: limit doldu ve 429 döndü": (r) => r !== null,
      "A: Retry-After başlığı 1..900 sn tamsayı": (r) => r !== null && retryAfterValid(r, 900),
      "A: 429 gövdesi JSON ve retryAfterSeconds içeriyor": (r) => {
        if (!r) return false;
        try {
          return typeof r.json("retryAfterSeconds") === "number";
        } catch (_) {
          return false;
        }
      },
      "A: 429 gövdesinde iç ayrıntı yok": (r) => r !== null && !leaksInternals(r.body),
    }, { part: "A" });

    if (first429) {
      const again = http.post(url, body, params);
      check(again, { "A: sonraki istek de 429": (r) => r.status === 429 }, { part: "A" });
    }
  });

  group("B: başlık sahteciliğiyle limit atlatma", () => {
    if (!first429) {
      console.warn("B atlandı: A'da 429 alınamadı");
      return;
    }
    const spoofs = {
      "CF-Connecting-IP": { "CF-Connecting-IP": `203.0.113.${randomOctet()}` },
      "X-Forwarded-For": { "X-Forwarded-For": `198.51.100.${randomOctet()}` },
      "X-Forwarded-For (çoklu)": { "X-Forwarded-For": `198.51.100.${randomOctet()}, 192.0.2.${randomOctet()}` },
      "X-Real-IP": { "X-Real-IP": `192.0.2.${randomOctet()}` },
      "hepsi birden": {
        "CF-Connecting-IP": `203.0.113.${randomOctet()}`,
        "X-Forwarded-For": `198.51.100.${randomOctet()}`,
        "X-Real-IP": `192.0.2.${randomOctet()}`,
      },
    };
    for (const [label, extra] of Object.entries(spoofs)) {
      const res = http.post(url, body, { ...params, headers: { ...params.headers, ...extra } });
      check(res, { [`B: sahte ${label} ile hâlâ 429`]: (r) => r.status === 429 }, { part: "B" });
      if (res.status !== 429) console.error(`B: sahte ${label} başlığı limiti atlattı → ${res.status}`);
    }
  });

  group("C: müşteri sipariş limiti", () => {
    // Yük testleri 1 numaralı masayı tutar; demo masası son 30 dk başka cihazdaysa yetkili oturum verilmez
    const menu = http.get(`${BASE_URL}/api/menu/${BUSINESS_ID}/${RL_TABLE}`, { responseCallback: EXPECTED });
    let tableId = null;
    try {
      tableId = menu.json("table.id");
    } catch (_) {
      /* aşağıda kontrol */
    }
    if (!tableId) {
      console.warn("C atlandı: demo masası bulunamadı (staging seed edildi mi?)");
      return;
    }
    const session = http.post(`${BASE_URL}/api/customer/session`, JSON.stringify({ businessId: BUSINESS_ID, tableId }), params);
    let token = null;
    let auth = null;
    try {
      token = session.json("sessionToken");
      auth = session.json("authorizationStatus");
    } catch (_) {
      /* aşağıda kontrol */
    }
    if (!token || auth !== "AUTHORIZED") {
      console.warn(`C atlandı: yetkili demo oturumu alınamadı (authorizationStatus=${auth}) — başka masa deneyin: -e RL_TABLE_NUMBER=3`);
      return;
    }
    // Geçersiz ürünle iki sipariş: limit sayacı ürün doğrulamasından önce artar, veritabanına sipariş yazılmaz
    const orderBody = JSON.stringify({ items: [{ productId: "ratelimit-probe-olmayan-urun", quantity: 1 }] });
    const orderParams = { headers: { "Content-Type": "application/json", "x-session-token": token }, responseCallback: EXPECTED, tags: { name: "customer_orders" } };
    const o1 = http.post(`${BASE_URL}/api/customer/orders`, orderBody, orderParams);
    const o2 = http.post(`${BASE_URL}/api/customer/orders`, orderBody, orderParams);
    console.log(`C: sipariş denemeleri → ${o1.status}, ${o2.status}`);
    check(o2, {
      "C: ikinci sipariş 429": (r) => r.status === 429,
      "C: sipariş 429'unda Retry-After 1..10 sn": (r) => r.status === 429 && retryAfterValid(r, 10),
    }, { part: "C" });
  });
}
