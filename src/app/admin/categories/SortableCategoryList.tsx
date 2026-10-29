"use client";

// dnd-kit yalnız bu dosyada: sayfa bunu next/dynamic ile yükler, ilk paket küçük kalır
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit3, GripVertical, Trash2 } from "lucide-react";
import type { Category } from "./types";

type ItemProps = {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
};

function SortableCategoryItem({ cat, onEdit, onDelete }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          {...attributes}
          {...listeners}
          type="button"
          style={{
            cursor: "grab",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            padding: 4,
            touchAction: "none",
          }}
          title="Sıralamak için sürükleyin"
        >
          <GripVertical size={18} />
        </button>
        <span style={{ fontSize: 28 }}>{cat.icon || "📁"}</span>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {cat._count?.products ?? 0} ürün • Sıra: {cat.sortOrder + 1}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onEdit(cat)} className="btn btn-ghost btn-sm" title="Düzenle">
          <Edit3 size={15} />
        </button>
        <button onClick={() => onDelete(cat)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger-text)" }} title="Sil">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

type ListProps = Omit<ItemProps, "cat"> & {
  items: Category[];
  /** Sürüklenen kategorinin id'si ve bırakıldığı yerdeki kategorinin id'si */
  onMove: (activeId: string, overId: string) => void;
};

export default function SortableCategoryList({ items, onMove, ...itemProps }: ListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((cat) => (
            <SortableCategoryItem key={cat.id} cat={cat} {...itemProps} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
