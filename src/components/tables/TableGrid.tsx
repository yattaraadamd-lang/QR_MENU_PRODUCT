import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Skeleton from "@/components/ui/Skeleton";

export type TableGridDensity = "comfortable" | "compact";

const GRID_CLASS: Record<TableGridDensity, string> = {
  comfortable: "grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3",
  compact: "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5",
};

const SKELETON_HEIGHT: Record<TableGridDensity, string> = {
  comfortable: "h-36",
  compact: "h-28",
};

const SKELETON_COUNT = 6;

interface TableGridProps {
  density: TableGridDensity;
  label: string;
  children: ReactNode;
}

/** Masa kartları listesi (ul > li); kartlar sırayla belirir (.stagger) */
export function TableGrid({ density, label, children }: TableGridProps) {
  return (
    <ul aria-label={label} className={cn("stagger", GRID_CLASS[density])}>
      {children}
    </ul>
  );
}

export function TableGridSkeleton({ density }: { density: TableGridDensity }) {
  return (
    <div role="status" aria-label="Masalar yükleniyor" className={GRID_CLASS[density]}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <Skeleton key={i} className={SKELETON_HEIGHT[density]} />
      ))}
    </div>
  );
}
