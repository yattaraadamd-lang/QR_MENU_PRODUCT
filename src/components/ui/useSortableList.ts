"use client";

import { useEffect, useRef } from "react";
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type MoveDirection = "up" | "down";

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "Taşımak için Boşluk tuşuna basın, ok tuşlarıyla yerini değiştirin. Bırakmak için yeniden Boşluk, vazgeçmek için Esc tuşuna basın.",
};

interface Options<T extends { readonly id: string }> {
  items: readonly T[];
  getName: (item: T) => string;
  /** Taşınan öğenin id'si ve yerine geçtiği öğenin id'si */
  onMove: (activeId: string, overId: string) => void;
}

/**
 * Sıralanabilir listenin davranışı (FE-ARCH-3.9c): sürükleme sensörleri, Türkçe ekran okuyucu
 * duyuruları, bırakma ve ok düğmeleriyle tek adım taşıma. Düğmeyle taşınan satır DOM'da yer
 * değiştirince odak düşer: aynı satırın aynı yöndeki düğmesine (uca geldiyse diğerine) geri
 * verilir. SortableList yalnız çizer.
 */
export function useSortableList<T extends { readonly id: string }>({ items, getName, onMove }: Options<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterMove = useRef<{ id: string; direction: MoveDirection } | null>(null);

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

  /** Ok düğmesiyle bir adım taşıma */
  const step = (id: string, overId: string, direction: MoveDirection) => {
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

  return {
    listRef,
    step,
    /** DndContext'e olduğu gibi verilir */
    dndContextProps: {
      sensors,
      collisionDetection: closestCenter,
      onDragEnd: handleDragEnd,
      accessibility: { announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS },
    },
  };
}
