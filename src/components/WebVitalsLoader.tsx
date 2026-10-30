"use client";

import { lazy, Suspense } from "react";

// web-vitals kütüphanesi ilk yüke girmesin (her rotaya ≈3,4 KB gzip ekliyordu); ayrı chunk
// olarak sonradan iner. LCP/FCP/TTFB tamponlanmış performans kayıtlarından okunur.
// next/dynamic yerine React.lazy: onun istemci çalışma zamanı da ≈1 KB ekliyordu.
const WebVitals = lazy(() => import("./WebVitals"));

export default function WebVitalsLoader() {
  return (
    <Suspense fallback={null}>
      <WebVitals />
    </Suspense>
  );
}
