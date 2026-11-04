import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Dialog from "@/components/ui/Dialog";
import styles from "./customer-menu.module.css";

interface MenuSheetProps {
  onClose: () => void;
  children: ReactNode;
  /** Alt dolgu yok: içerik kendi kaydırma alanında (sepet) */
  flush?: boolean;
}

/** Alttan açılan sayfa (yerel <dialog>): ürün, sepet, garson ve hizmet pencerelerinin ortak kabuğu */
export default function MenuSheet({ onClose, children, flush = false }: MenuSheetProps) {
  return (
    <Dialog
      onClose={onClose}
      overlayClassName={styles.sheetOverlay}
      contentClassName={cn("modal-content modal-sheet", styles.sheet, flush && styles.sheetFlush)}
    >
      {children}
    </Dialog>
  );
}
