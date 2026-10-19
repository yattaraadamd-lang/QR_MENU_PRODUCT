// Normal yük: BASE_VUS eşzamanlı kullanıcı (%70 QR müşterisi, %30 landing ziyaretçisi), 5 dk sabit.
//   k6 run -e BASE_URL=https://qr-menu-platform-staging.onrender.com maturity-audit/tests/load/normal.js
// Ayarlar: -e BASE_VUS=10 -e HOLD=5m -e P95_API_MS=800 -e P95_PAGE_MS=1500
import { COMMON_OPTIONS } from "./lib/target.js";
import { mixedVisit, defaultThresholds } from "./lib/flows.js";
import { warmUp } from "./lib/warmup.js";

const BASE_VUS = Number(__ENV.BASE_VUS || 10);

export const options = {
  ...COMMON_OPTIONS,
  scenarios: {
    normal: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: BASE_VUS },
        { duration: __ENV.HOLD || "5m", target: BASE_VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: defaultThresholds(),
};

export function setup() {
  return warmUp();
}

const state = {}; // VU başına: müşteri oturum token'ı tekrar kullanılır (sayfa yenileme gibi)

export default function () {
  mixedVisit(state);
}
