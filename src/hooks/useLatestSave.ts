"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ApiResult } from "@/lib/api-client";

/**
 * Art arda gelen kayıtları tek sıraya dizer: aynı anda tek istek uçar, beklerken gelenlerden
 * yalnız sonuncusu gönderilir (hızlı ok tıklamalarında eski sıralama yenisini ezmesin).
 * `onSettled` sıra bitince bir kez çağrılır; istek başarısız olursa bekleyen atılır.
 */
export function useLatestSave<T>(
  save: (value: T) => Promise<ApiResult<unknown>>,
  onSettled: (result: ApiResult<unknown>) => void,
) {
  const handlers = useRef({ save, onSettled });
  useEffect(() => {
    handlers.current = { save, onSettled };
  });
  const pending = useRef<{ value: T } | null>(null);
  const running = useRef(false);

  return useCallback(async (value: T) => {
    pending.current = { value };
    if (running.current) return;
    running.current = true;
    let result: ApiResult<unknown> | undefined;
    while (pending.current) {
      const next = pending.current.value;
      pending.current = null;
      result = await handlers.current.save(next);
      if (!result.ok) pending.current = null;
    }
    running.current = false;
    if (result) handlers.current.onSettled(result);
  }, []);
}
