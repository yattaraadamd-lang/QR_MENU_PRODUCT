"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useLatestSave } from "@/hooks/useLatestSave";
import { nextSortOrder, reorderById } from "@/lib/reorder";
import { CATEGORIES_URL, selectCategories } from "@/components/categories/categories.api";
import { useConfirm } from "@/components/ui/useConfirm";
import { FILTER_ALL, filterProducts, productTabs } from "./productModel";
import { PRODUCTS_URL, productsApi, selectProducts } from "./products.api";
import type { ProductDTO } from "./types";

/** Ürün ekranı: liste, filtre, iyimser sıralama ve stok, form penceresi, silme onayı */
export function useAdminProductsPage() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user.businessId);
  const productsQuery = useApiQuery(signedIn ? PRODUCTS_URL : null, { select: selectProducts });
  const categoriesQuery = useApiQuery(signedIn ? CATEGORIES_URL : null, { select: selectCategories });
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const [filter, setFilter] = useState(FILTER_ALL);
  const [search, setSearch] = useState("");
  /** null: pencere kapalı; product null: yeni ürün */
  const [form, setForm] = useState<{ product: ProductDTO | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const saveOrder = useLatestSave(productsApi.reorder, (result) => {
    if (result.ok) {
      toast.success("Ürün sıralaması güncellendi");
    } else {
      toast.error(result.error);
      void productsQuery.refresh(); // Ekrandaki iyimser sıra sunucudakine döner
    }
  });

  /** Sıra tüm listede değişir (filtreliyken de) */
  const move = (activeId: string, overId: string) => {
    const next = reorderById(products, activeId, overId);
    if (!next) return;
    productsQuery.mutate(() => next);
    void saveOrder(next);
  };

  const setLocalStock = (id: string, stockStatus: ProductDTO["stockStatus"]) =>
    productsQuery.mutate((list) => (list ?? []).map((item) => (item.id === id ? { ...item, stockStatus } : item)));

  const toggleStock = async (product: ProductDTO) => {
    const stockStatus = product.stockStatus === "IN_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK";
    setLocalStock(product.id, stockStatus);
    setBusyId(product.id);
    const result = await productsApi.setStock(product.id, stockStatus);
    setBusyId(null);
    if (result.ok) {
      toast.success(stockStatus === "IN_STOCK" ? `${product.name} stoğa alındı` : `${product.name} stoktan çıkarıldı`);
    } else {
      setLocalStock(product.id, product.stockStatus);
      toast.error(result.error);
    }
  };

  const remove = async (product: ProductDTO) => {
    const confirmed = await confirm({
      title: "Ürün silinsin mi?",
      description: `"${product.name}" menüden kaldırılacak. Bu işlem geri alınamaz.`,
      confirmText: "Sil",
    });
    if (!confirmed) return;

    setBusyId(product.id);
    const result = await productsApi.remove(product.id);
    setBusyId(null);
    if (result.ok) {
      toast.success(`"${product.name}" silindi`);
      void productsQuery.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleSaved = (message: string) => {
    setForm(null);
    toast.success(message);
    void productsQuery.refresh();
  };

  return {
    productsQuery,
    error: productsQuery.error ?? categoriesQuery.error,
    retry: () => {
      void productsQuery.refresh();
      void categoriesQuery.refresh();
    },
    total: products.length,
    visible: filterProducts(products, filter, search),
    categories,
    tabs: productTabs(products, categories),
    nextOrder: nextSortOrder(products),
    filter,
    setFilter,
    search,
    setSearch,
    form,
    openCreate: () => setForm({ product: null }),
    openEdit: (product: ProductDTO) => setForm({ product }),
    closeForm: () => setForm(null),
    handleSaved,
    move,
    toggleStock,
    remove,
    busyId,
    confirmDialog,
  };
}
