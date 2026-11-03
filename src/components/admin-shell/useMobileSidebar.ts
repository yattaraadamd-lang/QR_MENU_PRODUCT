"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** globals.css .admin-sidebar ile aynı kırılım: bu genişlikte kenar çubuğu sabit ve görünür */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Telefonda soldan kayan kenar çubuğu. Açılınca odak ilk menü linkine gider; Esc ya da örtüye
 * tıklama kapatıp odağı menü düğmesine döndürür (iade efektte: içerik kapanana kadar inert).
 * Masaüstüne geçilince kapanır; açık kalsa içerik inert ve örtülü kalırdı.
 */
export function useMobileSidebar(sidebarId: string) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        menuButtonRef.current?.focus();
      }
      return;
    }
    document.querySelector<HTMLElement>(`#${sidebarId} nav a`)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      restoreFocusRef.current = true;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sidebarId]);

  /** Kullanıcı kapattı (Esc/örtü): odak menü düğmesine döner */
  const dismiss = useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);

  /** Link seçildi: sayfa değişir, odak yeni sayfada kalır */
  const closeOnNavigate = useCallback(() => setOpen(false), []);

  return { open, openSidebar: () => setOpen(true), dismiss, closeOnNavigate, menuButtonRef };
}
