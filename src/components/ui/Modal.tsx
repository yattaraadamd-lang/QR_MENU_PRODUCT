"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Dialog from "./Dialog";
import styles from "./Modal.module.css";

type ModalSize = "sm" | "md";

interface ModalProps {
  /** false iken çizilmez; verilmezse takıldığı an açıktır (Dialog ile aynı) */
  open?: boolean;
  onClose: () => void;
  /** Pencerenin adı: Dialog ilk başlığı aria-labelledby yapar */
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  /** Alt eylem çubuğu; gövde uzunsa kaydırma yalnız gövdede olur */
  footer?: ReactNode;
  /** Başlık ve alt çubuğu çizgiyle ayır (uzun, kayan içerik) */
  dividers?: boolean;
  bodyClassName?: string;
  children?: ReactNode;
}

/** Başlıklı modal iskeleti: başlık + kapat düğmesi, kayan gövde, sabit alt çubuk. */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "sm",
  footer,
  dividers = false,
  bodyClassName,
  children,
}: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} contentClassName={cn("modal-content flex flex-col", styles[size])}>
      {/* div, header/footer değil: main dışında çizilirse sayfanın banner/contentinfo'su sayılırdı */}
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-5 pt-5",
          dividers ? "border-b border-line-subtle pb-4" : "pb-3",
        )}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight text-fg">{title}</h2>
          {description && <p className="mt-1 text-sm text-fg-secondary">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="tap-target -mr-1.5 -mt-1 flex shrink-0 items-center justify-center rounded-sm text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <CloseIcon />
        </button>
      </div>
      {children && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5", dividers ? "py-4" : "pb-2", bodyClassName)}>
          {children}
        </div>
      )}
      {footer && (
        <div className={cn("flex flex-wrap gap-2 px-5 pb-5", dividers ? "border-t border-line-subtle pt-4" : "pt-3")}>
          {footer}
        </div>
      )}
    </Dialog>
  );
}

/** lucide "x" ile aynı çizim; satır içi: ikon kütüphanesi sayfa paketine kopyalanmaz */
function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
