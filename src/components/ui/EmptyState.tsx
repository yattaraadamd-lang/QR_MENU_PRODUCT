import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** Dekoratif ikon/emoji (ekran okuyucuya okunmaz) */
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** "card": kendi kartında (sayfa); "plain": çerçevesiz (modal/kart içi) */
  variant?: "card" | "plain";
}

export default function EmptyState({ icon, title, description, action, variant = "card" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 text-center",
        variant === "card" ? "card px-6 py-12" : "px-4 py-8",
      )}
    >
      <div aria-hidden="true" className="mb-2 text-5xl leading-none">
        {icon}
      </div>
      <p className="text-base font-bold text-fg">{title}</p>
      {description && <p className="max-w-xs text-sm leading-normal text-fg-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
