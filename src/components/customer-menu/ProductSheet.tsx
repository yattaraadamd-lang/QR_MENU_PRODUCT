"use client";

import { useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { ORDER_LIMITS } from "@/contracts/orders";
import { formatTRY } from "@/lib/format";
import MenuSheet from "./MenuSheet";
import SheetHeader from "./SheetHeader";
import { orderable, type Product } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  product: Product;
  onClose: () => void;
  onAdd: (p: Product, note?: string) => void;
};

/** Ürün ayrıntısı (alttan açılan sayfa): açıklama, içerik, alerjen, özel not */
export default function ProductSheet({ product, onClose, onAdd }: Props) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const ok = orderable(product);

  const handleAdd = () => {
    onAdd(product, noteRef.current?.value.trim() || undefined);
    onClose();
  };

  return (
    <MenuSheet onClose={onClose}>
      <SheetHeader title={product.name} onClose={onClose} />
      <div className={styles.sheetBody}>
        {product.description && <p className={styles.lead}>{product.description}</p>}
        {product.ingredients && (
          <div className={styles.infoBox}>
            <p className={styles.infoLabel}>İçindekiler</p>
            <p className={styles.infoText}>{product.ingredients}</p>
          </div>
        )}
        {product.allergens && (
          <div className={`${styles.infoBox} ${styles.allergen}`}>
            <p className={styles.infoLabel}>
              <AlertTriangle size={13} aria-hidden="true" /> Alerjenler
            </p>
            <p className={styles.infoText}>{product.allergens}</p>
          </div>
        )}
        {ok && (
          <div className={styles.noteField}>
            <label htmlFor={noteId} className={styles.fieldLabel}>Özel not (isteğe bağlı)</label>
            <textarea id={noteId} ref={noteRef} placeholder="Örn: soğansız, az pişmiş" maxLength={ORDER_LIMITS.itemNote} className={`input ${styles.note}`} />
          </div>
        )}
        <div className={styles.sheetFooter}>
          <span className={styles.sheetPrice}>{formatTRY(product.price)}</span>
          <button type="button" disabled={!ok} onClick={handleAdd} className="btn btn-primary btn-lg">
            {ok ? "Sepete ekle" : "Şu an mevcut değil"}
          </button>
        </div>
      </div>
    </MenuSheet>
  );
}
