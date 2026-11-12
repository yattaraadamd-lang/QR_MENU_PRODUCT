"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { createVitalsQueue } from "@/lib/vitals-queue";

/**
 * Gerçek kullanıcı ölçümleri (FE-ITEM-3.9): LCP, INP, CLS, FCP, TTFB → /api/vitals.
 * Yalnız üretimde. Yol yerine rota deseni gider: QR token'ı, davet kodu ve işletme/masa
 * kimliği sunucu loglarına düşmez. Ölçüler kuyrukta bekler, sayfa gizlenince tek istekte gider
 * (FE-ARCH-3.9b); sendBeacon sayfa kapanırken de teslim eder.
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

const queue = createVitalsQueue((body) => {
  if (!navigator.sendBeacon?.("/api/vitals", body)) {
    fetch("/api/vitals", { method: "POST", body, keepalive: true }).catch(() => {
      // Ölçüm en iyi çabayla gönderilir: kaybı kullanıcıyı etkilemez, yeniden denenmez
    });
  }
});

// Modül düzeyinde: useReportWebVitals geri çağrı değişince web-vitals dinleyicilerini yeniden kurar
function report(metric: VitalSample) {
  if (process.env.NODE_ENV !== "production") return;
  queue.add({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    route: routeOf(window.location.pathname),
  });
}

function flushWhenHidden() {
  if (document.visibilityState === "hidden") queue.flush();
}

export default function WebVitals() {
  useReportWebVitals(report);
  useEffect(() => {
    // web-vitals LCP, CLS ve INP'yi sayfa gizlenirken belgedeki dinleyicilerinde bildirir; CLS'ninki
    // FCP'den sonra kurulduğu için bizimkinden sonra gelir. Olay belgeden pencereye kabarır:
    // pencerede dinlenince hepsinden sonra çalışır, ölçüler tek istekte gider.
    window.addEventListener("visibilitychange", flushWhenHidden);
    // visibilitychange'i kapanışta vermeyen eski Safari için
    window.addEventListener("pagehide", queue.flush);
    return () => {
      window.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", queue.flush);
    };
  }, []);
  return null;
}
