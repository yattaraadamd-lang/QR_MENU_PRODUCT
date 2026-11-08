"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { MENU_POLL_MS } from "./constants";
import { getMenu } from "./customer.api";
import type { Business, Category, MenuResponse, TableInfo } from "./types";

/**
 * Masa menüsü. `initial` verilirse (sunucuda çizilen sayfa) ilk istek atılmaz, menü
 * ilk karede hazırdır; yoksa ilk yükleme istemcide yapılır. Sonra sekme görünürken
 * 60 sn'de bir If-None-Match ile yenilenir (menü değişmediyse gövdesiz 304, state değişmez).
 * `onData` her yeni yanıtta çağrılır (ilk yüklemede `initial` true).
 */
export function useMenuData(
  businessId: string,
  tableNumber: string,
  onData: (data: MenuResponse, initial: boolean) => void,
  initial?: { data: MenuResponse; etag: string },
) {
  const [business, setBusiness] = useState<Business | null>(initial?.data.business ?? null);
  const [table, setTable] = useState<TableInfo | null>(initial?.data.table ?? null);
  const [categories, setCategories] = useState<Category[]>(initial?.data.categories ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  // Son menü yanıtının ETag'i — periyodik yenilemede If-None-Match olarak gönderilir
  const etagRef = useRef<string | null>(initial?.etag ?? null);
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });

  const fetchMenu = useCallback(async (isInitial: boolean) => {
    try {
      const result = await getMenu(businessId, tableNumber, isInitial ? null : etagRef.current);
      if (result.kind === "fresh") {
        etagRef.current = result.etag;
        setBusiness(result.menu.business);
        setTable(result.menu.table);
        setCategories(result.menu.categories);
        onDataRef.current(result.menu, isInitial);
      } else if (result.kind === "failed" && isInitial) {
        setError(result.error);
      }
    } finally {
      // Menü hemen gösterilir; oturum doğrulaması onData içinde arka planda sürer
      if (isInitial) setLoading(false);
    }
  }, [businessId, tableNumber]);

  // İlk yükleme: sunucudan geldiyse yalnız onData (sepet temizliği, oturum hidrasyonu)
  // tetiklenir; ref, StrictMode'un çift efektinde ikinci kez tetiklenmesin diye
  const initialHandledRef = useRef(false);
  const initialRef = useRef(initial);
  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;
    if (initialRef.current) onDataRef.current(initialRef.current.data, true);
    else fetchMenu(true);
  }, [fetchMenu]);

  // Burada yalnız periyodik ve sekme öne gelince yenileme
  const refresh = useCallback(() => fetchMenu(false), [fetchMenu]);
  useVisiblePolling(refresh, MENU_POLL_MS, true, false);

  return { business, table, categories, loading, error, refresh };
}
