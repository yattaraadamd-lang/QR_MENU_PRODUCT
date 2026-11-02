import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./tone";

export type AlertTone = Exclude<Tone, "primary" | "accent">;

interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
  /** Sağdaki eylem (ör. "Tekrar dene") */
  action?: ReactNode;
  /** "alert": belirdiği an duyurulur (hata); bilgi kutusunda verilmez */
  role?: "alert" | "status";
  className?: string;
}

const TONE_CLASS: Record<AlertTone, string> = {
  success: "border-success/25 bg-success/10 text-success-fg",
  warning: "border-warning/30 bg-warning/10 text-warning-fg",
  danger: "border-danger/25 bg-danger/10 text-danger-fg",
  info: "border-info/25 bg-info/10 text-info-fg",
  purple: "border-purple/25 bg-purple/10 text-purple-fg",
  neutral: "border-line bg-surface-hover text-fg-secondary",
};

/** Renkli bilgi/uyarı kutusu. Renk çifti token'lardan gelir. */
export default function Alert({ tone, children, action, role, className }: AlertProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 rounded-md border px-3.5 py-3 text-sm leading-normal",
        action ? "items-center" : "items-start",
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
