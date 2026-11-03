"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClipboardList, CreditCard, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";
import NavCountBadge from "@/components/staff/NavCountBadge";

interface WaiterNavItem {
  readonly href: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly badge: keyof Omit<BadgeCounts, "total">;
}

const WAITER_NAV: readonly WaiterNavItem[] = [
  { href: "/waiter", label: "Siparişler", Icon: ClipboardList, badge: "orders" },
  { href: "/waiter/requests", label: "Talepler", Icon: Bell, badge: "requests" },
  { href: "/waiter/payments", label: "Ödemeler", Icon: CreditCard, badge: "payments" },
  { href: "/waiter/tables", label: "Masalar", Icon: Table2, badge: "payments" },
];

interface WaiterBottomNavProps {
  counts: BadgeCounts;
  /** Yükseklik ölçümü (useCssHeightVar): içerik menünün altında kalmasın */
  navRef: (el: HTMLElement | null) => void;
}

/** Telefona göre alt menü; güvenli alan payı (çentik/ev çubuğu) dahil */
export default function WaiterBottomNav({ counts, navRef }: WaiterBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      ref={navRef}
      aria-label="Garson menüsü"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-muted pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      <ul className="flex">
        {WAITER_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              {/* Etiket DOM'da önce: ekran okuyucu "Siparişler, bekleyen 3" okur; simge görsel olarak üstte */}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col-reverse items-center gap-[3px] px-1 pb-1.5 pt-2.5 text-[10px] transition-colors",
                  active ? "font-bold text-primary-light" : "font-medium text-fg-secondary hover:text-fg",
                )}
              >
                {active && <span aria-hidden="true" className="absolute inset-x-[20%] top-0 h-0.5 rounded-b bg-primary" />}
                <span>{item.label}</span>
                <span className="relative inline-flex">
                  <item.Icon aria-hidden="true" className="size-[22px]" />
                  <NavCountBadge count={counts[item.badge]} placement="corner" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
