import type { RefObject } from "react";
import { Menu } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { NotificationPanel } from "@/components/notifications";

interface AdminTopBarProps {
  sidebarId: string;
  sidebarOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenMenu: () => void;
}

/** Üst çubuk (main dışında: banner landmark'ı). Menü düğmesi ve logo yalnız telefonda (.admin-mobile-only) */
export default function AdminTopBar({ sidebarId, sidebarOpen, menuButtonRef, onOpenMenu }: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface-muted px-5 py-3">
      <div className="flex items-center gap-3">
        {/* Görünürlüğü .admin-mobile-only yönetir: display yardımcısı eklemeyin, onu ezer */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label="Menüyü aç"
          aria-expanded={sidebarOpen}
          aria-controls={sidebarId}
          className="admin-mobile-only tap-target justify-center rounded-sm p-1 text-fg hover:bg-surface-hover"
        >
          <Menu aria-hidden="true" className="size-[22px]" />
        </button>
        <span className="admin-mobile-only">
          <BrandLogo size="sm" />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <NotificationPanel />
      </div>
    </header>
  );
}
