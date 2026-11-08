"use client";

import { lazy, Suspense, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { FILTER_ALL } from "@/components/admin-products/productModel";
import { useAdminProductsPage } from "@/components/admin-products/useAdminProductsPage";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterTabs from "@/components/ui/FilterTabs";
import Input from "@/components/ui/Input";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const loadProductList = () => import("@/components/admin-products/ProductList");
// dnd-kit (≈18 KB gzip) ilk yük paketinin dışında; veri beklenirken paralel iner
const ProductList = lazy(loadProductList);
// Yalnız tıklamayla açılır
const ProductFormDialog = lazy(() => import("@/components/admin-products/ProductFormDialog"));

const SKELETON_COUNT = 3;

function ListSkeleton() {
  return (
    <div role="status" aria-label="Ürünler yükleniyor" className="flex flex-col gap-2">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

export default function AdminProductsScreen() {
  const page = useAdminProductsPage();
  const { productsQuery, visible, form, search, filter } = page;

  useEffect(() => {
    void loadProductList();
  }, []);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Ürün Yönetimi</h1>
          <p className="mt-[3px] text-[13px] text-fg-secondary">
            {page.total} ürün · Sürükleyerek ya da oklarla sıralayın, stok durumunu tek tıkla değiştirin
          </p>
        </div>
        <Button leftIcon={<Plus className="size-4" />} onClick={page.openCreate}>
          Yeni Ürün
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-56">
          <Input
            type="search"
            aria-label="Ürün ara"
            value={search}
            onChange={(e) => page.setSearch(e.target.value)}
            placeholder="Ürün ara..."
            leftIcon={<Search aria-hidden="true" className="size-4" />}
          />
        </div>
        <FilterTabs<string> label="Kategori" tabs={page.tabs} value={filter} onChange={page.setFilter} />
      </div>

      {/* Hata "Henüz ürün eklenmemiş" gibi görünmesin: boş liste yalnız başarılı yanıttan */}
      <QueryError message={page.error} onRetry={page.retry} />

      {productsQuery.isLoading && <ListSkeleton />}

      {!productsQuery.isLoading && visible.length === 0 && !productsQuery.error && (
        <ProductsEmpty search={search.trim()} filtered={filter !== FILTER_ALL} onCreate={page.openCreate} />
      )}

      {visible.length > 0 && (
        <Suspense fallback={<ListSkeleton />}>
          <ProductList
            items={visible}
            busyId={page.busyId}
            onMove={page.move}
            onToggleStock={page.toggleStock}
            onEdit={page.openEdit}
            onDelete={page.remove}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {form && (
          <ProductFormDialog
            product={form.product}
            categories={page.categories}
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

/** Arama, boş kategori ve gerçekten hiç ürün olmaması farklı şeyler söyler */
function ProductsEmpty({ search, filtered, onCreate }: { search: string; filtered: boolean; onCreate: () => void }) {
  if (search) return <EmptyState icon="🔍" title={`"${search}" için ürün bulunamadı`} />;
  if (filtered) return <EmptyState icon="📦" title="Bu kategoride ürün yok" />;
  return (
    <EmptyState
      icon="📦"
      title="Henüz ürün eklenmemiş"
      action={
        <Button leftIcon={<Plus className="size-3.5" />} onClick={onCreate}>
          İlk Ürünü Ekle
        </Button>
      }
    />
  );
}
