import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./tone";

interface BadgeProps {
  tone?: Tone;
  /** Metnin önünde renk noktası */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/** Hap rozet. Zemin/yazı çifti temada `.badge-<tone>` olarak tanımlı (kontrastı orada ölçülür). */
export default function Badge({ tone = "primary", dot = false, children, className }: BadgeProps) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)}>
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
