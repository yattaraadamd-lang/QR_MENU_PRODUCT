"use client";

import React, { useEffect, useRef } from "react";

/**
 * Landing hareketleri — framer-motion'sız (landing'in ilk yükünden ≈30 KB gzip JS ve
 * hidrasyon işi kalktı). Görsel kurallar globals.css "Landing hareketleri" bölümünde.
 */

/** İlk ekran CSS giriş animasyonunun gecikmesi (globals.css .enter-*): sırayla gelme */
export const enterDelay = (seconds: number) => ({ "--enter-delay": `${seconds}s` }) as React.CSSProperties;

/** RevealGroup çocuğunun sırası: gecikme = sıra × grubun gap'i */
export const revealIndex = (i: number) => ({ "--i": i }) as React.CSSProperties;

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
      style={{ "--reveal-gap": `${gap}s`, ...style } as React.CSSProperties}
      {...props}
    />
  );
}

/**
 * Fare imlecini takip eden 3D eğim: açı CSS değişkenine yazılır, yumuşatma CSS geçişiyle
 * (globals.css .tilt). Yalnız fare; dokunmatikte ve "hareketi azalt"ta kapalı.
 */
export function Tilt({ max = 10, className = "", ...props }: DivProps & { max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (x: number, y: number) => {
    ref.current?.style.setProperty("--tilt-x", `${(-y * 2 * max).toFixed(2)}deg`);
    ref.current?.style.setProperty("--tilt-y", `${(x * 2 * max).toFixed(2)}deg`);
  };
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    set((e.clientX - rect.left) / rect.width - 0.5, (e.clientY - rect.top) / rect.height - 0.5);
  };
  return <div ref={ref} onPointerMove={handleMove} onPointerLeave={() => set(0, 0)} className={`tilt ${className}`} {...props} />;
}
