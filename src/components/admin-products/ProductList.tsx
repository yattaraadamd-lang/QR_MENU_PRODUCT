"use client";

import { Edit3, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTRY } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SortableList from "@/components/ui/SortableList";
import { TONE_TEXT, TONE_TINT, type Tone } from "@/components/ui/tone";
import { stockMeta } from "./productModel";
import type { ProductDTO } from "./types";

/** Satırdaki stok noktası: anlamı yanındaki rozet taşır, süs */
const DOT_CLASS: Partial<Record<Tone, string>> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

interface ProductActions {
  busyId: string | null;
  onToggleStock: (product: ProductDTO) => void;
  onEdit: (product: ProductDTO) => void;
  onDelete: (product: ProductDTO) => void;
}

interface ProductListProps extends ProductActions {
  items: readonly ProductDTO[];
  onMove: (activeId: string, overId: string) => void;
}

/** Sıralanabilir ürün listesi (dnd-kit bu dosyanın üzerinden iner: ekran bunu lazy yükler) */
export default function ProductList({ items, onMove, ...actions }: ProductListProps) {
  return (
    <SortableList
      items={items}
      label="Ürünler"
      getName={(product) => product.name}
      onMove={onMove}
      className="card overflow-hidden"
      itemClassName="border-b border-line-subtle last:border-b-0"
      renderRow={(product, { handle, moveButtons }) => {
        const stock = stockMeta(product.stockStatus);
        return (
          // Dar ekranda fiyat ve eylemler alt satıra iner
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
            <div className="flex min-w-[200px] flex-1 items-center gap-3">
              {handle}
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", DOT_CLASS[stock.tone])} />
              <ProductSummary product={product} />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <span className={cn("shrink-0 text-[15px] font-bold tabular-nums", product.isAvailable ? "text-primary-light" : "text-fg-secondary")}>
                {formatTRY(product.price)}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <StockToggle product={product} busy={actions.busyId === product.id} onToggle={actions.onToggleStock} />
                {moveButtons}
                <Button variant="ghost" size="icon" aria-label={`${product.name}: düzenle`} title="Düzenle" onClick={() => actions.onEdit(product)}>
                  <Edit3 aria-hidden="true" className="size-3.5" />
                </Button>
                <Button
                  variant="danger-ghost"
                  size="icon"
                  disabled={actions.busyId === product.id}
                  aria-label={`${product.name}: sil`}
                  title="Sil"
                  onClick={() => actions.onDelete(product)}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}

/** Gizli ürün satırı soluklaşmaz (metin AA altına düşerdi): ad ikincil renge çekilir, rozet eşlik eder */
function ProductSummary({ product }: { product: ProductDTO }) {
  const stock = stockMeta(product.stockStatus);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("break-words text-sm font-semibold", product.isAvailable ? "text-fg" : "text-fg-secondary")}>{product.name}</span>
        {product.isPopular && (
          <Badge tone="warning">
            <Star aria-hidden="true" className="size-2.5" /> Popüler
          </Badge>
        )}
        {!product.isAvailable && <Badge tone="neutral">Gizli</Badge>}
        {product.stockStatus !== "IN_STOCK" && <Badge tone={stock.tone}>{stock.label}</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-fg-secondary">{product.category?.name ?? "Kategorisiz"}</p>
    </div>
  );
}

function StockToggle({ product, busy, onToggle }: { product: ProductDTO; busy: boolean; onToggle: (product: ProductDTO) => void }) {
  const inStock = product.stockStatus === "IN_STOCK";
  const tone: Tone = inStock ? "success" : "danger";
  return (
    <button
      type="button"
      aria-pressed={inStock}
      disabled={busy}
      title={inStock ? "Stoktan çıkar" : "Stoğa al"}
      onClick={() => onToggle(product)}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-2xs font-bold transition-colors disabled:opacity-60",
        TONE_TINT[tone],
        TONE_TEXT[tone],
      )}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {inStock ? "Stokta" : "Yok"}
      <span className="sr-only"> — {product.name}</span>
    </button>
  );
}
