"use client";

import { useEffect, useState } from "react";

/** Belirli aralıkla tazelenen "şimdi" (ms). Süre gösterimleri render içinde Date.now() çağırmaz. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
