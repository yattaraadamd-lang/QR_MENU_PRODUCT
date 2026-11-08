"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useLatestSave } from "@/hooks/useLatestSave";
import { nextSortOrder, reorderById } from "@/lib/reorder";
import { useConfirm } from "@/components/ui/useConfirm";
import { categoriesApi, CATEGORIES_URL, selectCategories } from "@/components/categories/categories.api";
import type { CategoryDTO } from "@/components/categories/types";

/** Kategori ekranı: liste, iyimser sıralama, form penceresi, silme onayı */
export function useAdminCategoriesPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? CATEGORIES_URL : null, { select: selectCategories });
  const categories = query.data ?? [];

  /** null: pencere kapalı; category null: yeni kategori */
  const [form, setForm] = useState<{ category: CategoryDTO | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const saveOrder = useLatestSave(categoriesApi.reorder, (result) => {
    if (result.ok) {
      toast.success("Kategori sıralaması güncellendi");
    } else {
      toast.error(result.error);
      void query.refresh(); // Ekrandaki iyimser sıra sunucudakine döner
    }
  });

  const move = (activeId: string, overId: string) => {
    const next = reorderById(categories, activeId, overId);
    if (!next) return;
    query.mutate(() => next);
    void saveOrder(next);
  };

  const remove = async (category: CategoryDTO) => {
    const products = category._count.products;
    if (products > 0) {
      toast.error(`"${category.name}" kategorisinde ${products} ürün var. Silmeden önce ürünleri başka kategoriye taşıyın.`);
      return;
    }
    const confirmed = await confirm({
      title: "Kategori silinsin mi?",
      description: `"${category.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: "Sil",
    });
    if (!confirmed) return;

    setDeletingId(category.id);
    const result = await categoriesApi.remove(category.id);
    setDeletingId(null);
    if (result.ok) {
      toast.success(`"${category.name}" kategorisi silindi`);
      void query.refresh();
    } else if (!result.aborted) {
      // Liste eskiyse (ürün yeni eklendiyse) sunucunun nedeni burada görünür
      toast.error(result.error);
      void query.refresh();
    }
  };

  const handleSaved = (message: string) => {
    setForm(null);
    toast.success(message);
    void query.refresh();
  };

  return {
    query,
    categories,
    nextOrder: nextSortOrder(categories),
    form,
    openCreate: () => setForm({ category: null }),
    openEdit: (category: CategoryDTO) => setForm({ category }),
    closeForm: () => setForm(null),
    handleSaved,
    move,
    remove,
    deletingId,
    confirmDialog,
  };
}
