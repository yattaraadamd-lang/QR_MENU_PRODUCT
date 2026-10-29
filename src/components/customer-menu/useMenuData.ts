"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { MENU_POLL_MS } from "./constants";
import type { Business, Category, MenuResponse, TableInfo } from "./types";

/**
 * Masa menüsü. İlk yükleme bir kez; sonra sekme görünürken 60 sn'de bir
 * If-None-Match ile yenilenir (menü değişmediyse gövdesiz 304, state değişmez).
 * `onData` her yeni yanıtta çağrılır (ilk yüklemede `initial` true).
 */
export function useMenuData(
  businessId: string,
  tableNumber: string,
  onData: (data: MenuResponse, initial: boolean) => void,
) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Son menü yanıtının ETag'i — periyodik yenilemede If-None-Match olarak gönderilir
  const etagRef = useRef<string | null>(null);
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });

  const fetchMenu = useCallback(async (initial: boolean) => {
    try {
      const headers: Record<string, string> = {};
      if (!initial && etagRef.current) headers["If-None-Match"] = etagRef.current;
      const res = await fetch(`/api/menu/${businessId}/${tableNumber}`, { headers, cache: "no-store" });
      if (res.status === 304) return;
      const data = await res.json();
      if (res.ok) {
        etagRef.current = res.headers.get("ETag");
        const menu: MenuResponse = { ...data, categories: data.categories || [] };
        setBusiness(menu.business);
        setTable(menu.table);
        setCategories(menu.categories);
        onDataRef.current(menu, initial);
      } else if (initial) {
        setError(data.error || "Menü yüklenemedi.");
      }
    } catch {
      if (initial) setError("Bağlantı hatası.");
    } finally {
      // Menü hemen gösterilir; oturum doğrulaması onData içinde arka planda sürer
      if (initial) setLoading(false);
    }
  }, [businessId, tableNumber]);

  useEffect(() => { fetchMenu(true); }, [fetchMenu]);
  // İlk yükleme yukarıda; burada yalnız periyodik ve sekme öne gelince yenileme
  const refresh = useCallback(() => fetchMenu(false), [fetchMenu]);
  useVisiblePolling(refresh, MENU_POLL_MS, true, false);

  return { business, table, categories, loading, error, refresh };
}
