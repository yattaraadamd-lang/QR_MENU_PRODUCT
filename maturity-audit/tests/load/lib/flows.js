// Gerçekçi kullanıcı akışları — normal.js ve spike.js ortak kullanır.
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter } from "k6/metrics";
import { BASE_URL, BUSINESS_ID, TABLE_NUMBER, BROWSER_UA, leaksInternals } from "./target.js";

export const serverErrors = new Counter("server_errors_5xx");
export const internalLeaks = new Counter("internal_detail_leaks");

const OK = http.expectedStatuses({ min: 200, max: 399 });
// Oturum durumu: VIEW_ONLY/yetkisiz oturum 401/403/409 alabilir — bunlar hata değil
const STATUS_OK = http.expectedStatuses({ min: 200, max: 299 }, 401, 403, 409);

function track(res) {
  if (res.status >= 500) serverErrors.add(1, { name: res.request && res.request.tags ? res.request.tags.name : "" });
  if (leaksInternals(res.body)) internalLeaks.add(1);
  return res;
}

function think(min, max) {
  sleep(min + Math.random() * (max - min));
}

// QR okutan müşteri: menü sayfası → menü API → müşteri oturumu → durum → aktif talep yoklaması
export function customerVisit(state) {
  const headers = { "User-Agent": BROWSER_UA, "Accept-Language": "tr-TR,tr;q=0.9" };

  group("müşteri: menü", () => {
    const page = track(
      http.get(`${BASE_URL}/menu/${BUSINESS_ID}/${TABLE_NUMBER}`, {
        headers,
        responseCallback: OK,
        tags: { name: "page_menu", kind: "page" },
      })
    );
    check(page, { "menü sayfası 200": (r) => r.status === 200 });

    const menu = track(
      http.get(`${BASE_URL}/api/menu/${BUSINESS_ID}/${TABLE_NUMBER}`, {
        headers,
        responseCallback: OK,
        tags: { name: "api_menu", kind: "api" },
      })
    );
    check(menu, { "menü API 200": (r) => r.status === 200 });
    if (menu.status !== 200) return;

    let tableId = null;
    try {
      tableId = menu.json("table.id");
    } catch (_) {
      /* gövde JSON değilse aşağıdaki check yakalar */
    }
    if (!check(tableId, { "menü yanıtında masa id": (t) => typeof t === "string" && t.length > 0 })) return;

    const session = track(
      http.post(
        `${BASE_URL}/api/customer/session`,
        JSON.stringify({ businessId: BUSINESS_ID, tableId, existingToken: state.token || undefined }),
        {
          headers: { ...headers, "Content-Type": "application/json" },
          responseCallback: OK,
          tags: { name: "api_customer_session", kind: "api" },
        }
      )
    );
    check(session, { "oturum 200": (r) => r.status === 200 });
    try {
      const token = session.json("sessionToken");
      if (typeof token === "string") state.token = token;
    } catch (_) {
      /* yok say */
    }

    if (state.token) {
      track(
        http.get(`${BASE_URL}/api/customer/session/status`, {
          headers: { ...headers, "x-session-token": state.token },
          responseCallback: STATUS_OK,
          tags: { name: "api_session_status", kind: "api" },
        })
      );
    }

    // Menü açıkken istemci aktif talepleri yoklar
    for (let i = 0; i < 2; i++) {
      think(2, 4);
      track(
        http.get(`${BASE_URL}/api/customer/active-requests?tableId=${tableId}&businessId=${BUSINESS_ID}`, {
          headers: state.token ? { ...headers, "x-session-token": state.token } : headers,
          responseCallback: OK,
          tags: { name: "api_active_requests", kind: "api" },
        })
      );
    }
  });
}

// Pazarlama ziyaretçisi: ana sayfa → giriş/kayıt sayfası
export function marketingVisit() {
  const headers = { "User-Agent": BROWSER_UA, "Accept-Language": "tr-TR,tr;q=0.9" };
  group("ziyaretçi: landing", () => {
    const home = track(http.get(`${BASE_URL}/`, { headers, responseCallback: OK, tags: { name: "page_home", kind: "page" } }));
    check(home, { "ana sayfa 200": (r) => r.status === 200 });
    think(1, 3);
    const path = Math.random() < 0.5 ? "/auth/signin" : "/auth/signup";
    track(http.get(`${BASE_URL}${path}`, { headers, responseCallback: OK, tags: { name: "page_auth", kind: "page" } }));
  });
}

export function mixedVisit(state) {
  if (Math.random() < 0.7) customerVisit(state);
  else marketingVisit();
  think(1, 3);
}

// Ortak eşikler (görevdeki hedefler): hata oranı < %1, p95 sınırları env ile ayarlanabilir
export function defaultThresholds() {
  const apiP95 = Number(__ENV.P95_API_MS || 800);
  const pageP95 = Number(__ENV.P95_PAGE_MS || 1500);
  return {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:api}": [`p(95)<${apiP95}`],
    "http_req_duration{kind:page}": [`p(95)<${pageP95}`],
    server_errors_5xx: ["count<1"],
    internal_detail_leaks: ["count<1"],
    checks: ["rate>0.99"],
  };
}
