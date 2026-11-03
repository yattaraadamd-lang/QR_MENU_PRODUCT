"use client";

import { signOut } from "next-auth/react";
import { LogOut, Store } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";
import AdminNav from "./AdminNav";

interface AdminSidebarProps {
  id: string;
  open: boolean;
  businessName: string | null | undefined;
  userName: string | null | undefined;
  counts: BadgeCounts;
  onNavigate: () => void;
}

/** Kenar çubuğu: marka, işletme, menü, kullanıcı ve çıkış. Konum/gizlenme globals.css .admin-sidebar'da */
export default function AdminSidebar({ id, open, businessName, userName, counts, onNavigate }: AdminSidebarProps) {
  const initials = userName?.slice(0, 2).toUpperCase() || "AD";

  return (
    <aside id={id} className="admin-sidebar" data-open={open}>
      <div className="border-b border-line-subtle px-4 pb-3.5 pt-[18px]">
        <div className="panel-brand">
          <BrandLogo size="sm" />
          <p className="panel-brand-sub">Yönetim paneli</p>
        </div>
        {businessName && (
          <p className="mt-2.5 flex items-center gap-1.5 rounded-sm bg-surface-hover px-2.5 py-1.5 text-xs text-fg-secondary">
            <Store aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{businessName}</span>
          </p>
        )}
      </div>

      <AdminNav counts={counts} onNavigate={onNavigate} />

      <div className="border-t border-line-subtle px-2.5 py-3">
        <div className="mb-2 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-on"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{userName}</p>
            <p className="text-2xs text-fg-secondary">Admin</p>
          </div>
        </div>
        {/* .btn ortalar (globals Tailwind'den sonra gelir): menü linkiyle aynı sola dayalı görünüm */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2.5 text-xs font-semibold text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
