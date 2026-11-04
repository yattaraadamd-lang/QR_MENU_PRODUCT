"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ScrollRegionProps {
  /** Ekran okuyucuya okunacak bölge adı (ör. "Ödemeler tablosu"). */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Yatay kayan tablo kabı. İçerik taştığında klavyeyle odaklanabilir olur,
 * böylece ok tuşlarıyla kaydırılabilir (WCAG 2.1.1, axe
 * "scrollable-region-focusable"). Taşmadığında gereksiz sekme durağı eklemez.
 */
export default function ScrollRegion({ label, children, className }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      // Kaydırılabilir bölge klavyeyle ulaşılabilir olmalı (WCAG 2.1.1);
      // jsx-a11y bu meşru istisnayı tanımıyor.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={overflows ? 0 : undefined}
      // relative: içerideki mutlak konumlu öğeler (sr-only metin, rozet) da kapla kırpılır;
      // yoksa en yakın konumlu ata dışarıda kalır ve dar ekranda sayfayı yatay taşırırlar
      className={cn("relative overflow-x-auto", className)}
    >
      {children}
    </div>
  );
}
