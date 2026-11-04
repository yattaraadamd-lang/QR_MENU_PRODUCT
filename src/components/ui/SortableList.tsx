"use client";

// dnd-kit yalnız bu dosyada: ekranlar bunu kullanan listeyi React.lazy ile yükler, ilk paket küçük kalır
import { useEffect, useRef, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";

type Direction = "up" | "down";

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "Taşımak için Boşluk tuşuna basın, ok tuşlarıyla yerini değiştirin. Bırakmak için yeniden Boşluk, vazgeçmek için Esc tuşuna basın.",
};

export interface SortableRowParts {
  /** Sürükleme tutamağı (klavyede Boşluk + oklar) */
  handle: ReactNode;
  /** Sürüklemeden tek dokunuşla taşıma (WCAG 2.5.7) */
  moveButtons: ReactNode;
  /** Listedeki gerçek konum (0'dan) */
  index: number;
}

interface SortableListProps<T extends { readonly id: string }> {
  items: readonly T[];
  /** Listenin ekran okuyucu adı */
  label: string;
  /** Düğme adları ve duyurular için */
  getName: (item: T) => string;
  /** Taşınan öğenin id'si ve yerine geçtiği öğenin id'si */
  onMove: (activeId: string, overId: string) => void;
  renderRow: (item: T, parts: SortableRowParts) => ReactNode;
  className?: string;
  itemClassName?: string;
}

/** Sıralanabilir liste: sürükle-bırak, klavye ve ok düğmeleri; duyurular Türkçe */
export default function SortableList<T extends { readonly id: string }>({
  items,
  label,
  getName,
  onMove,
  renderRow,
  className,
  itemClassName,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterMove = useRef<{ id: string; direction: Direction } | null>(null);

  // Taşınan satır DOM'da yer değiştirince odak düşer; uca geldiyse o yöndeki düğme kapanır
  useEffect(() => {
    const target = focusAfterMove.current;
    if (!target) return;
    focusAfterMove.current = null;
    const row = Array.from(listRef.current?.children ?? []).find(
      (el) => (el as HTMLElement).dataset.sortableId === target.id,
    );
    const button =
      row?.querySelector<HTMLButtonElement>(`[data-move="${target.direction}"]:not(:disabled)`) ??
      row?.querySelector<HTMLButtonElement>("[data-move]:not(:disabled)");
    button?.focus();
  }, [items]);

  const step = (id: string, overId: string, direction: Direction) => {
    focusAfterMove.current = { id, direction };
    onMove(id, overId);
  };

  const nameOf = (id: UniqueIdentifier) => {
    const item = items.find((entry) => entry.id === id);
    return item ? getName(item) : "Öğe";
  };
  const positionOf = (id: UniqueIdentifier) => items.findIndex((entry) => entry.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOf(active.id)} taşınıyor.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)}, ${positionOf(over.id)}. sıranın üzerinde.` : `${nameOf(active.id)} bir sıranın üzerinde değil.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} ${positionOf(over.id)}. sıraya bırakıldı.` : `${nameOf(active.id)} bırakıldı.`,
    onDragCancel: ({ active }) => `Taşıma iptal edildi, ${nameOf(active.id)} yerinde kaldı.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul ref={listRef} aria-label={label} className={className}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              name={getName(item)}
              index={index}
              previousId={items[index - 1]?.id}
              nextId={items[index + 1]?.id}
              onStep={step}
              className={itemClassName}
            >
              {(parts) => renderRow(item, parts)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  name: string;
  index: number;
  previousId?: string;
  nextId?: string;
  onStep: (id: string, overId: string, direction: Direction) => void;
  className?: string;
  children: (parts: SortableRowParts) => ReactNode;
}

function SortableRow({ id, name, index, previousId, nextId, onStep, className, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    attributes: { roleDescription: "sıralanabilir öğe" },
  });

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${name}: sürükleyerek taşı`}
      title="Sıralamak için sürükleyin"
      className="flex shrink-0 cursor-grab touch-none items-center rounded-sm p-1 text-fg-muted transition-colors hover:text-fg active:cursor-grabbing"
    >
      <GripVertical aria-hidden="true" className="size-[18px]" />
    </button>
  );

  const moveButtons = (
    <>
      <Button
        variant="ghost"
        size="icon"
        data-move="up"
        disabled={!previousId}
        aria-label={`${name}: yukarı taşı`}
        title="Yukarı taşı"
        onClick={() => previousId && onStep(id, previousId, "up")}
      >
        <ChevronUp aria-hidden="true" className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        data-move="down"
        disabled={!nextId}
        aria-label={`${name}: aşağı taşı`}
        title="Aşağı taşı"
        onClick={() => nextId && onStep(id, nextId, "down")}
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </Button>
    </>
  );

  return (
    <li
      ref={setNodeRef}
      data-sortable-id={id}
      // transform/transition dnd-kit'ten her karede gelir
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-60", className)}
    >
      {children({ handle, moveButtons, index })}
    </li>
  );
}
