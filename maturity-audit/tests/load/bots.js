// Karışık bot trafiği: arama motoru + yapay zekâ tarayıcıları + betik istemcileri.
// Senaryolar:
//   crawlers   — karışık bot UA'ları, BOT_RATE istek/sn (varsayılan 5), 3 dk
//   aggressive — tek bir agresif tarayıcı, AGGR_RATE istek/sn (varsayılan 20), 1 dk (robots.txt'i yok sayar)
//   humans     — aynı anda 3 gerçek müşteri; bot yükü altında yaşadıkları gecikme ölçülür
// Kontroller: 5xx yok, iç hata sızıntısı yok, bot ile tarayıcı aynı yolda aynı durum kodunu alır,
// robots.txt / sitemap.xml her UA için 200, staging'de X-Robots-Tag: noindex var.
//   k6 run -e BASE_URL=https://qr-menu-platform-staging.onrender.com maturity-audit/tests/load/bots.js
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE_URL, BUSINESS_ID, TABLE_NUMBER, BROWSER_UA, COMMON_OPTIONS, leaksInternals } from "./lib/target.js";
import { customerVisit, internalLeaks as leaks } from "./lib/flows.js";
import { warmUp } from "./lib/warmup.js";

const BOTS = {
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Googlebot-Mobile":
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  YandexBot: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  Applebot: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  "ChatGPT-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Claude-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  "Claude-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  CCBot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  Bytespider: "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  "Meta-ExternalAgent": "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  AhrefsBot: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
  SemrushBot: "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  curl: "curl/8.9.1",
  "python-requests": "python-requests/2.32.3",
  "UA-yok": "",
};
const BOT_NAMES = Object.keys(BOTS);

// Botların gerçekte istediği yollar; /qr/ ve /api/ robots.txt'te kapalı ama kötü huylu botlar yine ister
const PATHS = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/auth/signin",
  "/auth/signup",
  `/menu/${BUSINESS_ID}/${TABLE_NUMBER}`,
  `/api/menu/${BUSINESS_ID}/${TABLE_NUMBER}`,
  "/qr/bot-tahmini-gecersiz-token",
  "/admin",
  "/waiter",
  "/api/health",
  "/olmayan-sayfa-404",
  "/favicon.ico",
];

const ANY_NON_5XX = http.expectedStatuses({ min: 200, max: 499 });
const BOT_RATE = Number(__ENV.BOT_RATE || 5);
const AGGR_RATE = Number(__ENV.AGGR_RATE || 20);

export const botServerErrors = new Counter("bot_server_errors_5xx");
export const botStatusMismatch = new Counter("bot_vs_browser_status_mismatch");

export const options = {
  ...COMMON_OPTIONS,
  scenarios: {
    crawlers: {
      executor: "constant-arrival-rate",
      exec: "crawl",
      rate: BOT_RATE,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    aggressive: {
      executor: "constant-arrival-rate",
      exec: "aggressive",
      startTime: "1m",
      rate: AGGR_RATE,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 30,
      maxVUs: 150,
    },
    humans: {
      executor: "constant-vus",
      exec: "human",
      vus: 3,
      duration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    bot_server_errors_5xx: ["count<1"],
    bot_vs_browser_status_mismatch: ["count<1"],
    internal_detail_leaks: ["count<1"],
    "http_req_duration{scenario:humans}": [`p(95)<${Number(__ENV.P95_API_MS || 800) * 2}`],
    "checks{check:robots_txt}": ["rate==1"],
  },
};

// Her yolun tarayıcıyla aldığı durum kodu — botlar aynısını almalı (gizli engelleme/cloaking yok)
export function setup() {
  warmUp();
  const baseline = {};
  for (const p of PATHS) {
    baseline[p] = http.get(`${BASE_URL}${p}`, { headers: { "User-Agent": BROWSER_UA }, responseCallback: ANY_NON_5XX, tags: { name: "baseline" } }).status;
  }
  return { baseline };
}

function botRequest(botName, path, baseline) {
  const ua = BOTS[botName];
  const headers = ua ? { "User-Agent": ua } : { "User-Agent": "" };
  const res = http.get(`${BASE_URL}${path}`, {
    headers,
    responseCallback: ANY_NON_5XX,
    tags: { name: `bot ${path}`, bot: botName, kind: path.startsWith("/api/") ? "api" : "page" },
  });

  if (res.status >= 500) botServerErrors.add(1, { bot: botName, path });
  if (leaksInternals(res.body)) leaks.add(1, { bot: botName, path });
  if (baseline && baseline[path] && res.status !== baseline[path] && res.status !== 429) {
    botStatusMismatch.add(1, { bot: botName, path, got: String(res.status), want: String(baseline[path]) });
  }

  if (path === "/robots.txt") {
    check(res, { "robots.txt 200 text/plain": (r) => r.status === 200 && /text\/plain/.test(r.headers["Content-Type"] || "") }, { check: "robots_txt" });
  }
  if (path === "/sitemap.xml") {
    check(res, { "sitemap.xml 200 xml": (r) => r.status === 200 && /xml/.test(r.headers["Content-Type"] || "") });
  }
  if (/staging/.test(BASE_URL) && res.status < 400) {
    check(res, { "staging: X-Robots-Tag noindex": (r) => /noindex/i.test(r.headers["X-Robots-Tag"] || "") });
  }
  return res;
}

export function crawl(data) {
  const bot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  botRequest(bot, path, data.baseline);
}

export function aggressive(data) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  botRequest("Bytespider", path, data.baseline);
}

const humanState = {};
export function human() {
  customerVisit(humanState);
}
