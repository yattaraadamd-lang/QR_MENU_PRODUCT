interface Sortable {
  readonly id: string;
  readonly sortOrder: number;
}

/**
 * Öğeyi hedefin yerine taşır ve sıraları baştan numaralar (dnd-kit arrayMove ile aynı yerleşim).
 * Taşıma yoksa null: gereksiz istek atılmaz.
 */
export function reorderById<T extends Sortable>(list: readonly T[], activeId: string, overId: string): T[] | null {
  const from = list.findIndex((item) => item.id === activeId);
  const to = list.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1 || from === to) return null;
  const moved = [...list];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  return moved.map((entry, index) => ({ ...entry, sortOrder: index }));
}

/** Yeni öğe listenin sonuna gelir (0 olsaydı ilk sıradakiyle çakışırdı) */
export function nextSortOrder(list: readonly Sortable[]): number {
  return list.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}
