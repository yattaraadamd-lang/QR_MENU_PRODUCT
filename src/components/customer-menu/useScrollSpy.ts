"use client";

import { useEffect, useRef, useState } from "react";
import { scrollBehavior } from "./constants";
import type { Category } from "./types";

/**
 * Kaydırırken etkin kategori (IntersectionObserver) ve mobil şeritte etkin sekmenin ortalanması.
 * Bölümler `sectionRef(id)` ile bağlanır; `scrollTo(id)` bölüme kaydırır (bölümün scroll-margin'i
 * yapışkan başlık ve şerit kadar). Henüz kaydırılmadıysa ilk kategori etkindir.
 */
export function useScrollSpy(categories: readonly Category[]) {
  const [observedId, setObservedId] = useState<string | null>(null);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const catId = entry.target.getAttribute("data-category-id");
        if (!catId) return;
        setObservedId(catId);
        // Sekmeyi şeridin içinde ara: masaüstü listesi DOM'da önce gelir ve
        // mobilde display:none olduğundan offsetLeft'i 0'dır
        const container = stripRef.current;
        const tab = container?.querySelector<HTMLElement>(`[data-tab-id="${catId}"]`);
        if (container && tab && container.offsetParent !== null) {
          const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
          container.scrollTo({ left: scrollLeft, behavior: scrollBehavior() });
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
    categories.forEach((cat) => {
      const el = sectionsRef.current[cat.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  const sectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionsRef.current[id] = el;
  };

  const scrollTo = (id: string) => {
    sectionsRef.current[id]?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
  };

  return { activeId: observedId ?? categories[0]?.id ?? null, stripRef, sectionRef, scrollTo };
}
