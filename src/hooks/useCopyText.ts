"use client";

import { useCallback, useState } from "react";

/**
 * Panoya kopyala. Pano izni yoksa (http, eski tarayıcı) `fallback` öğesinin metni seçilir;
 * kullanıcı kendisi kopyalar. Dönen değer: "copied" | "selected".
 */
export function useCopyText() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string, fallback?: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return "copied" as const;
    } catch {
      if (fallback) window.getSelection()?.selectAllChildren(fallback);
      return "selected" as const;
    }
  }, []);

  const reset = useCallback(() => setCopied(false), []);

  return { copied, copy, reset };
}
