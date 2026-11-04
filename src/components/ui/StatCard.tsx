import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import ToneStripe from "./ToneStripe";
import { TONE_TEXT, type Tone } from "./tone";

interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
  /** Sağdaki dekoratif simge/emoji (ekran okuyucuya okunmaz) */
  icon?: ReactNode;
  className?: string;
}

/** Özet sayı kartı: etiket + iri değer, sol kenarda ton şeridi */
export default function StatCard({ label, value, tone = "neutral", icon, className }: StatCardProps) {
  return (
    <div className={cn("card relative flex items-center justify-between gap-3 p-4", className)}>
      <ToneStripe tone={tone} />
      <div className="min-w-0">
        <p className="mb-1 text-xs text-fg-secondary">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", TONE_TEXT[tone])}>{value}</p>
      </div>
      {icon && (
        <span aria-hidden="true" className="shrink-0 text-4xl leading-none">
          {icon}
        </span>
      )}
    </div>
  );
}
