"use client";

import { Edit3, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import SortableList from "@/components/ui/SortableList";
import type { CategoryDTO } from "@/components/categories/types";

interface CategoryListProps {
  items: readonly CategoryDTO[];
  deletingId: string | null;
  onMove: (activeId: string, overId: string) => void;
  onEdit: (category: CategoryDTO) => void;
  onDelete: (category: CategoryDTO) => void;
}

/** Sıralanabilir kategori kartları (dnd-kit bu dosyanın üzerinden iner: ekran bunu lazy yükler) */
export default function CategoryList({ items, deletingId, onMove, onEdit, onDelete }: CategoryListProps) {
  return (
    <SortableList
      items={items}
      label="Kategoriler"
      getName={(category) => category.name}
      onMove={onMove}
      className="flex flex-col gap-2"
      itemClassName="card"
      renderRow={(category, { handle, moveButtons, index }) => (
        // Dar ekranda eylemler alt satıra iner
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
          <div className="flex min-w-[180px] flex-1 items-center gap-3">
            {handle}
            <span aria-hidden="true" className="text-[28px] leading-none">
              {category.icon || "📁"}
            </span>
            <div className="min-w-0">
              <p className="break-words text-[15px] font-semibold text-fg">{category.name}</p>
              <p className="text-xs text-fg-secondary">
                {category._count.products} ürün · Sıra: {index + 1}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 gap-1.5">
            {moveButtons}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${category.name}: düzenle`}
              title="Düzenle"
              onClick={() => onEdit(category)}
            >
              <Edit3 aria-hidden="true" className="size-[15px]" />
            </Button>
            <Button
              variant="danger-ghost"
              size="icon"
              loading={deletingId === category.id}
              aria-label={`${category.name}: sil`}
              title="Sil"
              onClick={() => onDelete(category)}
            >
              <Trash2 aria-hidden="true" className="size-[15px]" />
            </Button>
          </div>
        </div>
      )}
    />
  );
}
