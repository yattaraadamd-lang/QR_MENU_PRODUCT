"use client";

import { useCallback, useState } from "react";
import type { ApiResult } from "@/lib/api-client";

/**
 * Yazma isteği (POST/DELETE…) için bekleme ve hata durumu. `useApiQuery`'nin eşi:
 * modal içi hata `error` ile FormError'a verilir (açık <dialog> varken toast görünmez).
 * Eylem modül düzeyinde tanımlı bir servis fonksiyonu olmalı (kimliği sabit kalır).
 */
export function useApiMutation<TArgs extends readonly unknown[], TData>(
  action: (...args: TArgs) => Promise<ApiResult<TData>>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<ApiResult<TData>> => {
      setPending(true);
      setError(null);
      try {
        const result = await action(...args);
        if (!result.ok && !result.aborted) setError(result.error);
        return result;
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, setError, reset };
}
