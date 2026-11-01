"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./customer-menu.module.css";

type Props = {
  title: ReactNode;
  onClose: () => void;
};

/** Alttan açılan sayfaların başlığı; pencere adı bu h2'den gelir (Dialog) */
export default function SheetHeader({ title, onClose }: Props) {
  return (
    <div className={styles.sheetHead}>
      <h2 className={`font-display ${styles.sheetTitle}`}>{title}</h2>
      <button type="button" aria-label="Kapat" onClick={onClose} className={styles.closeBtn}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
