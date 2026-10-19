// 10x ani artış: BASE_VUS kullanıcı sürekli gezinirken 60. saniyede 10 sn içinde
// 9×BASE_VUS ek kullanıcı gelir (toplam 10x), 1 dk kalır, 10 sn içinde gider.
// "baseline" senaryosunun metrikleri, ani artış sırasında mevcut kullanıcıların ne yaşadığını gösterir.
//   k6 run -e BASE_URL=https://qr-menu-platform-staging.onrender.com maturity-audit/tests/load/spike.js
import { COMMON_OPTIONS } from "./lib/target.js";
import { mixedVisit } from "./lib/flows.js";
import { warmUp } from "./lib/warmup.js";

const BASE_VUS = Number(__ENV.BASE_VUS || 10);
const apiP95 = Number(__ENV.P95_API_MS || 800);

export const options = {
  ...COMMON_OPTIONS,
  scenarios: {
    baseline: {
      executor: "constant-vus",
      vus: BASE_VUS,
      duration: "4m",
    },
    spike: {
      executor: "ramping-vus",
      startTime: "60s",
      startVUs: 0,
      stages: [
        { duration: "10s", target: BASE_VUS * 9 },
        { duration: "1m", target: BASE_VUS * 9 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_failed{scenario:baseline}": ["rate<0.01"],
    "http_req_duration{scenario:baseline,kind:api}": [`p(95)<${apiP95 * 2}`],
    "http_req_duration{kind:api}": [`p(95)<${apiP95 * 3}`],
    internal_detail_leaks: ["count<1"],
  },
};

export function setup() {
  return warmUp();
}

const state = {};

export default function () {
  mixedVisit(state);
}
