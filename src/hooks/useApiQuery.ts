"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "./useVisiblePolling";

type Options<T> = {
  /** Yanıt gövdesinden veriyi seçer, ör. (j) => j.orders ?? [] */
  select: (json: unknown) => T;
  /** Sekme görünürken yenileme aralığı (ms); verilmezse yalnız ilk yükleme ve refresh */
  refreshInterval?: number;
  /** 401'de girişe yönlendir (oturumu düşmüş personel ekranı) */
  redirectOnUnauthorized?: boolean;
};

type QueryState<T> = { url: string | null; data: T | undefined; error: string | null };

/**
 * Personel ekranları için GET sorgusu.
 * - `url` null iken istek atılmaz (ör. oturum henüz yok); url değişince hemen yeniden çeker.
 * - `isLoading` geçerli url için henüz yanıt yokken true: oturum geç gelse de filtre değişse
 *   de ekran bir an boş liste göstermez.
 * - Yeni istek öncekini iptal eder (AbortController): filtre hızla değişince eski yanıt
 *   yenisinin üstüne yazılmaz. Ekran ayrılınca uçuştaki istek iptal edilir.
 * - Polling sekme görünürken çalışır, ön plana gelince hemen yeniler (useVisiblePolling).
 * - `mutate` iyimser güncelleme içindir: uçuştaki yanıtı geçersiz sayar, sonra `refresh`.
 */
export function useApiQuery<T>(url: string | null, { select, refreshInterval, redirectOnUnauthorized = true }: Options<T>) {
  const [state, setState] = useState<QueryState<T>>({ url: null, data: undefined, error: null });

  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });
  const controllerRef = useRef<AbortController | null>(null);
  // Yalnız en son isteğin yanıtı state'e yazılır
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!url) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const seq = ++seqRef.current;
    const fail = (error: string) =>
      setState((prev) => ({ url, data: prev.url === url ? prev.data : undefined, error }));
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (res.status === 401 && redirectOnUnauthorized) {
        window.location.href = "/auth/signin";
        return;
      }
      const json = await res.json().catch(() => null);
      if (seq !== seqRef.current) return;
      if (res.ok) {
        setState({ url, data: selectRef.current(json), error: null });
      } else {
        fail((json as { error?: string } | null)?.error || "Veriler alınamadı.");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError" || seq !== seqRef.current) return;
      fail("Bağlantı hatası. Yeniden deneniyor...");
    }
  }, [url, redirectOnUnauthorized]);

  // İlk yükleme ve url değişimi (ör. filtre); ayrılınca uçuştaki istek iptal
  useEffect(() => {
    if (!url) return;
    refresh();
    return () => controllerRef.current?.abort();
  }, [url, refresh]);

  useVisiblePolling(refresh, refreshInterval ?? 0, !!url && !!refreshInterval, false);

  const mutate = useCallback((updater: (prev: T | undefined) => T) => {
    // Uçuştaki eski yanıt iyimser güncellemeyi geri almasın
    seqRef.current++;
    setState((prev) => ({ ...prev, data: updater(prev.data) }));
  }, []);

  const isCurrent = url !== null && state.url === url;
  return {
    data: state.data,
    error: isCurrent ? state.error : null,
    isLoading: url === null ? !state.url : !isCurrent,
    refresh,
    mutate,
  };
}
