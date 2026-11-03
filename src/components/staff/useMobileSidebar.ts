"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Admin kabuğu: globals.css .admin-sidebar ile aynı kırılım (kenar çubuğu sabit ve görünür) */
const ADMIN_DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Telefonda açılan menü (admin: soldan kayan kenar çubuğu, süper admin: tam ekran panel).
 * `sidebarId` öğesinin içinde bir `nav` olmalı. Açılınca odak ilk menü linkine gider; Esc ya da örtüye
 * tıklama kapatıp odağı menü düğmesine döndürür (iade efektte: içerik kapanana kadar inert).
 * Masaüstüne geçilince kapanır; açık kalsa içerik inert ve örtülü kalırdı.
 */
export function useMobileSidebar(sidebarId: string, desktopQuery: string = ADMIN_DESKTOP_QUERY) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(desktopQuery);
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [desktopQuery]);

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

  return {
    open,
    openSidebar: () => setOpen(true),
    /** Menü düğmesi aç/kapa (kapatırken odak düğmede kalır) */
    toggle: () => (open ? dismiss() : setOpen(true)),
    dismiss,
    closeOnNavigate,
    menuButtonRef,
  };
}
