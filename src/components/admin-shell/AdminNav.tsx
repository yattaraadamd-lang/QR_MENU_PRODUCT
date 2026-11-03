"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";
import { ADMIN_NAV, NAV_GROUPS, badgeText } from "./navConfig";

interface AdminNavProps {
  counts: BadgeCounts;
  onNavigate: () => void;
}

/** Gruplu yönetim menüsü; etkin sayfa aria-current, bekleyen işler sayaçla */
export default function AdminNav({ counts, onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Yönetim menüsü" className="flex-1 overflow-y-auto px-2 py-2.5">
      {NAV_GROUPS.map((group) => {
        const items = ADMIN_NAV.filter((item) => item.group === group.key);
        if (items.length === 0) return null;
        return (
          <div key={group.key} className="mb-1">
            {group.label && (
              <p className="px-2.5 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-fg-muted">{group.label}</p>
            )}
            <ul>
              {items.map((item) => {
                const active = pathname === item.href;
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      // transition-colors ("all" değil): kenar çubuğunun visibility geçişini
                      // miras alırsa açılış anında gizli kalır ve odak alamaz
                      className={cn(
                        "mb-px flex items-center gap-2.5 rounded-sm border-l-2 px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 font-semibold text-primary-light"
                          : "border-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg",
                      )}
                    >
                      <item.Icon
                        aria-hidden="true"
                        className={cn("size-[18px] shrink-0", active ? "text-primary-light" : "text-fg-muted")}
                      />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="animate-pulse-glow min-w-[18px] shrink-0 rounded-full bg-danger px-1.5 text-center text-2xs font-extrabold leading-4 text-white">
                          <span className="sr-only">, bekleyen </span>
                          {badgeText(count)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
