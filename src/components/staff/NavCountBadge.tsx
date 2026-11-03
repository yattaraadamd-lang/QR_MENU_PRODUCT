import { cn } from "@/lib/cn";

/** Rozetlerde en fazla iki hane: 99'dan sonrası "99+" */
const MAX_BADGE = 99;

interface NavCountBadgeProps {
  count: number;
  /** "inline": menü satırının sonunda; "corner": ikonun sağ üst köşesinde (alt menü) */
  placement?: "inline" | "corner";
}

/** Menüde bekleyen iş sayacı; ekran okuyucu linki "Siparişler, bekleyen 3" diye okur */
export default function NavCountBadge({ count, placement = "inline" }: NavCountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "animate-pulse-glow rounded-full bg-danger text-center font-extrabold text-white",
        placement === "inline"
          ? "min-w-[18px] shrink-0 px-1.5 text-2xs leading-4"
          : "absolute -right-2 -top-1 min-w-[15px] px-1 text-[9px] leading-[13px]",
      )}
    >
      <span className="sr-only">, bekleyen </span>
      {count > MAX_BADGE ? `${MAX_BADGE}+` : count}
    </span>
  );
}
