import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import ToneStripe from "./ToneStripe";
import { TONE_TEXT, type Tone } from "./tone";

interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
  className?: string;
}

/** Özet sayı kartı: etiket + iri değer, sol kenarda ton şeridi */
export default function StatCard({ label, value, tone = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("card relative p-4", className)}>
      <ToneStripe tone={tone} />
      <p className="mb-1 text-xs text-fg-secondary">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", TONE_TEXT[tone])}>{value}</p>
    </div>
  );
}
