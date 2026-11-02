import Button from "@/components/ui/Button";
import type { OrderFilter } from "./types";

interface OrderFilterTabsProps {
  value: OrderFilter;
  onChange: (value: OrderFilter) => void;
  /** Aktif sekmesinde bekleyen sipariş sayacı */
  pendingCount: number;
}

/** Aktif / Geçmiş geçişi: seçili olan aria-pressed ile duyurulur */
export default function OrderFilterTabs({ value, onChange, pendingCount }: OrderFilterTabsProps) {
  const isActive = value === "active";

  return (
    <div role="group" aria-label="Sipariş filtresi" className="flex gap-1.5">
      <Button
        size="sm"
        variant={isActive ? "primary" : "ghost"}
        aria-pressed={isActive}
        onClick={() => onChange("active")}
      >
        Aktif
        {pendingCount > 0 && (
          <span className="rounded-full bg-danger px-1.5 text-2xs font-extrabold text-white">
            <span className="sr-only">, bekleyen </span>
            {pendingCount}
          </span>
        )}
      </Button>
      <Button size="sm" variant={isActive ? "ghost" : "primary"} aria-pressed={!isActive} onClick={() => onChange("completed")}>
        Geçmiş
      </Button>
    </div>
  );
}
