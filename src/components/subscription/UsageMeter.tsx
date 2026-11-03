import { cn } from "@/lib/cn";
import { formatLimit, usageLevel } from "./subscriptionModel";
import type { UsageDTO } from "./types";

const FILL: Record<ReturnType<typeof usageLevel>["tone"], string> = {
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Kullanım göstergesi (role="meter"): "Masalar 4 / 10", dolulukla renk değişir */
export default function UsageMeter({ label, usage }: { label: string; usage: UsageDTO }) {
  const level = usageLevel(usage);
  const limitText = formatLimit(usage.limit);

  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-sm">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-bold tabular-nums text-fg">
          {usage.current} / {limitText}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={usage.limit ?? usage.current}
        aria-valuenow={usage.current}
        aria-valuetext={`${usage.current} / ${limitText}`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-hover"
      >
        {/* Genişlik veriye bağlı tek değer: inline kalması bilinçli */}
        <div className={cn("h-full", FILL[level.tone])} style={{ width: `${level.percent}%` }} />
      </div>
    </div>
  );
}
