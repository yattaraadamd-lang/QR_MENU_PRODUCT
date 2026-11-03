"use client";

import type { RefObject } from "react";
import { Menu, X } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { useCssHeightVar } from "@/hooks/useCssHeightVar";
import SuperAdminNav, { SuperAdminSignOut } from "./SuperAdminNav";

interface SuperAdminMobileBarProps {
  menuId: string;
  open: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onNavigate: () => void;
}

/** Telefonda üst çubuk (banner) ve tam ekran menü; md ve üstünde gizli */
export default function SuperAdminMobileBar({ menuId, open, menuButtonRef, onToggle, onNavigate }: SuperAdminMobileBarProps) {
  // Menü yapışkan başlığın hemen altından başlar: yükseklik sabit sayı değil ölçülen değer
  const headerRef = useCssHeightVar("--sa-header-h");

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface-page px-5 py-4 md:hidden"
      >
        <BrandLogo size="sm" />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onToggle}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          className="flex size-11 items-center justify-center rounded-sm text-fg hover:bg-surface-hover"
        >
          {open ? <X aria-hidden="true" className="size-[22px]" /> : <Menu aria-hidden="true" className="size-[22px]" />}
        </button>
      </header>

      {open && (
        <div
          id={menuId}
          className="fixed inset-x-0 bottom-0 top-[var(--sa-header-h,60px)] z-30 flex flex-col gap-2 overflow-y-auto bg-surface-page p-5 md:hidden"
        >
          <SuperAdminNav variant="sheet" onNavigate={onNavigate} />
          <SuperAdminSignOut variant="sheet" />
        </div>
      )}
    </>
  );
}
