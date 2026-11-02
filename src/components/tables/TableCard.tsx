import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Badge from "@/components/ui/Badge";
import ToneStripe from "@/components/ui/ToneStripe";
import { countPendingActions, tableDisplayName, tableStatusMeta } from "./tableModel";
import type { TableGridDensity } from "./TableGrid";
import type { TableDTO } from "./types";

interface TableCardProps {
  table: TableDTO;
  onOpen: (table: TableDTO) => void;
  density?: TableGridDensity;
  /** Ad ve durumun altındaki içerik (adisyon, talepler…) */
  children?: ReactNode;
  /** Kartın üstünde tıklanabilir kalan düğmeler (QR, sil…) */
  actions?: ReactNode;
}

/**
 * Masa kartı. Kartın tamamı görünmez bir düğmeyle (.card-hit) açılır; ekran okuyucu
 * adı, durumu ve bekleyen işlem sayısını bu düğmeden duyar.
 */
export default function TableCard({ table, onOpen, density = "comfortable", children, actions }: TableCardProps) {
  const name = tableDisplayName(table);
  const status = tableStatusMeta(table.status);
  const pending = countPendingActions(table);
  const pendingText = pending > 0 ? `, ${pending} bekleyen işlem` : "";

  return (
    <li className={cn("card relative", density === "compact" ? "p-3.5" : "p-4")}>
      <ToneStripe tone={status.tone} />
      <button
        type="button"
        className="card-hit"
        onClick={() => onOpen(table)}
        aria-label={`${name}, ${status.label}${pendingText} — detayları aç`}
      />
      {pending > 0 && <PendingCount count={pending} />}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg">{name}</p>
          <p className="text-2xs text-fg-secondary">#{table.tableNumber}</p>
        </div>
        <Badge tone={status.tone} className="shrink-0">
          {status.label}
        </Badge>
      </div>

      {children}

      {actions && <div className="card-actions mt-2 flex gap-1.5">{actions}</div>}
    </li>
  );
}

function PendingCount({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="animate-pulse-glow absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-extrabold text-white outline outline-2 outline-surface"
    >
      {count}
    </span>
  );
}
