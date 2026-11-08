"use client";

import { lazy, Suspense, useEffect } from "react";
import { Plus } from "lucide-react";
import { useAdminCategoriesPage } from "@/components/admin-categories/useAdminCategoriesPage";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const loadCategoryList = () => import("@/components/admin-categories/CategoryList");
// dnd-kit (≈18 KB gzip) ilk yük paketinin dışında; veri beklenirken paralel iner
const CategoryList = lazy(loadCategoryList);
// Yalnız tıklamayla açılır
const CategoryFormDialog = lazy(() => import("@/components/admin-categories/CategoryFormDialog"));

const SKELETON_COUNT = 3;

function ListSkeleton() {
  return (
    <div role="status" aria-label="Kategoriler yükleniyor" className="flex flex-col gap-2">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <Skeleton key={i} className="h-[72px]" />
      ))}
    </div>
  );
}

export default function AdminCategoriesScreen() {
  const page = useAdminCategoriesPage();
  const { query, categories, form } = page;

  useEffect(() => {
    void loadCategoryList();
  }, []);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Kategori Yönetimi</h1>
          <p className="mt-0.5 text-[13px] text-fg-secondary">
            Kategorilerin menüdeki sırasını sürükleyerek ya da oklarla belirleyin
          </p>
        </div>
        <Button leftIcon={<Plus className="size-4" />} onClick={page.openCreate}>
          Yeni Kategori
        </Button>
      </header>

      {/* Hata "Henüz kategori yok" gibi görünmesin: boş liste yalnız başarılı yanıttan */}
      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && <ListSkeleton />}

      {!query.isLoading && categories.length === 0 && !query.error && <EmptyState icon="📁" title="Henüz kategori yok" />}

      {categories.length > 0 && (
        <Suspense fallback={<ListSkeleton />}>
          <CategoryList
            items={categories}
            deletingId={page.deletingId}
            onMove={page.move}
            onEdit={page.openEdit}
            onDelete={page.remove}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {form && (
          <CategoryFormDialog
            category={form.category}
            nextOrder={page.nextOrder}
            onClose={page.closeForm}
            onSaved={page.handleSaved}
          />
        )}
      </Suspense>

      {page.confirmDialog}
    </div>
  );
}
