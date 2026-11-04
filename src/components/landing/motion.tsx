"use client";

import React, { useEffect, useRef } from "react";

/**
 * Landing hareketleri — framer-motion'sız (landing'in ilk yükünden ≈30 KB gzip JS ve
 * hidrasyon işi kalktı). Görsel kurallar globals.css "Landing hareketleri" bölümünde.
 * Gecikme stilleri (enterDelay, revealIndex) sunucuda da çağrılabilsin diye motion-style.ts'te.
 */

export { enterDelay, revealIndex } from "./motion-style";

/**
 * Kaydırınca bir kez belirme. Sunucu HTML'inde blok görünür (JS yoksa da öyle kalır);
 * hidrasyondan sonra ekranın altında kalıyorsa data-reveal="pending" ile gizlenir,
 * görünür alana girince "shown" olur ve giriş animasyonu bir kez oynar. Zaten ekranda
 * olan blok olduğu gibi kalır: görünür bir şey kaybolup yeniden belirmez.
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Reveal({ className = "", ...props }: DivProps) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`reveal ${className}`} {...props} />;
}

/** Çocukları (.reveal-item + revealIndex(i)) sırayla belirir */
export function RevealGroup({ className = "", gap = 0.08, style, ...props }: DivProps & { gap?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal-group ${className}`}
      // eslint-disable-next-line no-restricted-syntax -- CSS değişkeni prop'tan gelir
      style={{ "--reveal-gap": `${gap}s`, ...style } as React.CSSProperties}
      {...props}
    />
  );
}
