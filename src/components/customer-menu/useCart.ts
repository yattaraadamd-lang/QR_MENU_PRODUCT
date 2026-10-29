"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { orderable, type CartItem, type Category, type Product } from "./types";

const storageKey = (businessId: string, tableNumber: string) => `qr_cart_${businessId}_${tableNumber}`;

const isCartItem = (v: unknown): v is CartItem => {
  const i = v as CartItem;
  return !!i && typeof i.quantity === "number" && i.quantity > 0 && typeof i.product?.id === "string";
};

function readStored(key: string): CartItem[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return []; // gizli pencere / engelli depolama
  }
}

/**
 * Masa bazlı sepet. Sekme oturumu boyunca sessionStorage'da tutulur: yanlışlıkla
 * yenileme ya da QR'ı yeniden okutma sepeti silmez; sipariş gidince temizlenir.
 */
export function useCart(businessId: string, tableNumber: string) {
  const key = storageKey(businessId, tableNumber);
  const [items, setItems] = useState<CartItem[]>([]);
  // Tüm değişiklikler buradan geçer: art arda çağrılar bayat state görmesin
  const itemsRef = useRef<CartItem[]>([]);
  // Hangi masa anahtarının geri yüklendiği (StrictMode'un çift efektinde tekrar yüklenmesin)
  const restoredRef = useRef<string | null>(null);

  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  // Sıra önemli: yazma efekti geri yüklemeden ÖNCE tanımlı, böylece ilk çalışmada
  // (henüz geri yüklenmemişken) boş sepet depodakinin üzerine yazılmaz
  useEffect(() => {
    if (restoredRef.current !== key) return;
    try {
      if (items.length) sessionStorage.setItem(key, JSON.stringify(items));
      else sessionStorage.removeItem(key);
    } catch { /* depolama yoksa sepet yalnız bellekte kalır */ }
  }, [items, key]);

  // Sunucu çiziminde sessionStorage yok: geri yükleme yalnız tarayıcıda, ilk çizimden sonra
  useEffect(() => {
    if (restoredRef.current === key) return;
    const stored = readStored(key);
    restoredRef.current = key;
    if (stored.length) {
      commit(stored);
      // Kökteki Toaster bu efektten sonra abone olur (kardeş öğe); hemen atılan toast kaybolurdu
      setTimeout(() => toast.success("Sepetiniz geri yüklendi."), 0);
    }
  }, [key, commit]);

  const add = useCallback((p: Product, note?: string) => {
    const prev = itemsRef.current;
    const ex = prev.find(i => i.product.id === p.id && i.customerNote === note);
    commit(ex
      ? prev.map(i => (i === ex ? { ...i, quantity: i.quantity + 1 } : i))
      : [...prev, { product: p, quantity: 1, customerNote: note }]);
  }, [commit]);

  const updateQty = useCallback((pid: string, note: string | undefined, d: number) => {
    commit(itemsRef.current
      .map(i => (i.product.id === pid && i.customerNote === note ? { ...i, quantity: i.quantity + d } : i))
      .filter(i => i.quantity > 0));
  }, [commit]);

  const clear = useCallback(() => commit([]), [commit]);

  /** Menü yenilenince: stokta olmayanı çıkar, kalanların ürün bilgisini (fiyat dahil) tazele */
  const prune = useCallback((categories: Category[]) => {
    const prev = itemsRef.current;
    if (prev.length === 0) return;
    const fresh = new Map<string, Product>();
    categories.forEach(c => (c.products || []).forEach(p => fresh.set(p.id, p)));
    const next = prev.flatMap(i => {
      const p = fresh.get(i.product.id);
      return p && orderable(p) ? [{ ...i, product: p }] : [];
    });
    commit(next);
    if (next.length < prev.length) toast.error("Stokta tükenen ürünler sepetinizden çıkarıldı.");
  }, [commit]);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return { items, add, updateQty, clear, prune, total, count };
}

export type CartApi = ReturnType<typeof useCart>;
