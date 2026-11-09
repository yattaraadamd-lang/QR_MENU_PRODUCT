"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Gerçek kullanıcı ölçümleri (FE-ITEM-3.9): LCP, INP, CLS, FCP, TTFB → /api/vitals.
 * Yalnız üretimde. Yol yerine rota deseni gider: QR token'ı, davet kodu ve işletme/masa
 * kimliği sunucu loglarına düşmez. sendBeacon sayfa kapanırken de teslim eder.
 */
const ROUTE_PATTERNS: [RegExp, string][] = [
  [/^\/qr\/[^/]+/, "/qr/[qrToken]"],
  [/^\/auth\/join\/[^/]+/, "/auth/join/[code]"],
  [/^\/menu\/[^/]+\/[^/]+/, "/menu/[businessId]/[tableNumber]"],
];

function routeOf(pathname: string) {
  for (const [re, pattern] of ROUTE_PATTERNS) if (re.test(pathname)) return pattern;
  return pathname.slice(0, 100);
}

/**
 * Gönderilen alanlar. next/web-vitals'ın Metric tipi derlenmiş pakette tanımsız kaldığı için
 * parametre any'ye düşüyordu (FE-ARCH-2.5); burada açıkça tiplenir.
 */
interface VitalSample {
  readonly name: string;
  readonly value: number;
  readonly rating?: string;
  readonly navigationType?: string;
}

export default function WebVitals() {
  useReportWebVitals((metric: VitalSample) => {
    if (process.env.NODE_ENV !== "production") return;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      route: routeOf(window.location.pathname),
    });
    if (!navigator.sendBeacon?.("/api/vitals", body)) {
      fetch("/api/vitals", { method: "POST", body, keepalive: true }).catch(() => {
        // Ölçüm en iyi çabayla gönderilir: kaybı kullanıcıyı etkilemez, yeniden denenmez
      });
    }
  });
  return null;
}
