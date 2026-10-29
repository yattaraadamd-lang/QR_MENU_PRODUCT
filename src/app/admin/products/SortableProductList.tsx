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
import { Circle, Edit3, GripVertical, Star, Trash2 } from "lucide-react";
import { formatTRY } from "@/lib/format";
import { stockInfo, type Product } from "./types";

type ItemProps = {
  p: Product;
  isLast: boolean;
  onToggleStock: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (target: { id: string; name: string }) => void;
};

function SortableProductItem({ p, isLast, onToggleStock, onEdit, onDelete }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
  });

  const si = stockInfo(p.stockStatus);
  const inStock = stockInfo(p.stockStatus === "IN_STOCK" ? "IN_STOCK" : "OUT_OF_STOCK");

  // Gizli ürünler satırı soluklaştırmak yerine (metin AA altına düşerdi)
  // ad ve fiyatı ikincil renge çekerek ayrışır; "Gizli" rozeti de eşlik eder.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
    background: isDragging ? "var(--surface-hover)" : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
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
          padding: 2,
          touchAction: "none",
          flexShrink: 0,
        }}
        title="Sıralamak için sürükleyin"
      >
        <GripVertical size={16} />
      </button>

      <Circle size={10} style={{ flexShrink: 0, color: si.color, fill: si.color }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: p.isAvailable ? undefined : "var(--text-secondary)" }}>{p.name}</span>
          {p.isPopular && <span className="badge badge-warning" style={{ fontSize: 10, gap: 3 }}><Star size={10} /> Popüler</span>}
          {!p.isAvailable && <span className="badge badge-neutral" style={{ fontSize: 10 }}>Gizli</span>}
          {p.stockStatus !== "IN_STOCK" && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: si.bg, color: si.color }}>
              {si.label}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {p.category?.name || "Kategorisiz"}
        </p>
      </div>

      <span style={{ fontWeight: 700, fontSize: 15, color: p.isAvailable ? "var(--primary-light)" : "var(--text-secondary)", flexShrink: 0 }}>
        {formatTRY(p.price)}
      </span>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStock(p); }}
          className="btn btn-sm"
          title={p.stockStatus === "IN_STOCK" ? "Stoktan Çıkar" : "Stoğa Al"}
          style={{
            padding: "4px 10px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            border: "none",
            background: inStock.bg,
            color: inStock.color,
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <Circle size={8} style={{ fill: "currentColor" }} />
          {p.stockStatus === "IN_STOCK" ? "Stokta" : "Yok"}
        </button>
        <button onClick={() => onEdit(p)} className="btn btn-sm btn-ghost" style={{ padding: "5px 8px" }} title="Düzenle">
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete({ id: p.id, name: p.name })} className="btn btn-sm btn-ghost" style={{ padding: "5px 8px", color: "var(--danger-text)" }} title="Sil">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

type ListProps = Omit<ItemProps, "p" | "isLast"> & {
  items: Product[];
  /** Sürüklenen ürünün id'si ve bırakıldığı yerdeki ürünün id'si */
  onMove: (activeId: string, overId: string) => void;
};

export default function SortableProductList({ items, onMove, ...itemProps }: ListProps) {
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
      <SortableContext items={items.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="card" style={{ overflow: "hidden" }}>
          {items.map((p, idx) => (
            <SortableProductItem key={p.id} p={p} isLast={idx === items.length - 1} {...itemProps} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
