// Render free planı 15 dk boşta kalınca uyur; ilk istek 30-60 sn sürebilir.
// Ölçüme soğuk başlangıç karışmasın diye setup() içinde /api/health 200 dönene kadar beklenir.
import http from "k6/http";
import { sleep } from "k6";
import { BASE_URL } from "./target.js";

export function warmUp(maxSeconds = 120) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const res = http.get(`${BASE_URL}/api/health`, { timeout: "60s", tags: { name: "warmup" }, responseCallback: http.expectedStatuses(200) });
    if (res.status === 200) return { warmedAt: new Date().toISOString() };
    sleep(5);
  }
  throw new Error(`${BASE_URL}/api/health ${maxSeconds} sn içinde 200 dönmedi — staging ayakta mı?`);
}
