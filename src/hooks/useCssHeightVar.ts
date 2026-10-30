"use client";

import { useCallback } from "react";

/**
 * Öğenin yüksekliğini CSS değişkeni olarak yayınlayan callback ref döndürür. Değişken en
 * yakın `[data-height-vars]` atasına (yoksa <html>'e) yazılır.
 *
 * Yapışkan başlık/şerit altındaki ofsetler sabit sayı yerine bu değişkeni kullanır:
 * yazı boyutu, satır kırılması ya da yakınlaştırma yüksekliği değiştirince ofset de
 * değişir. Öğe gizliyken (display:none) değer 0px olur; ilk çizimi CSS'teki varsayılan
 * karşılar. Callback ref olduğu için geç çizilen öğe (ör. menü yüklenince) de ölçülür.
 */
export function useCssHeightVar(name: `--${string}`) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const host = el.closest<HTMLElement>("[data-height-vars]") ?? document.documentElement;
      const write = () => host.style.setProperty(name, `${el.offsetHeight}px`);
      write();
      const observer = new ResizeObserver(write);
      observer.observe(el);
      return () => {
        observer.disconnect();
        host.style.removeProperty(name);
      };
    },
    [name],
  );
}
