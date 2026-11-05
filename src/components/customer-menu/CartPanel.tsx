"use client";

import { useId } from "react";
import { Lock, ShoppingBag } from "lucide-react";
import FormError from "@/components/ui/FormError";
import { formatTRY } from "@/lib/format";
import type { AuthStatus, CartItem } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  /** Yalnız modal (mobil sepet) içinde verilir: toast modalın arkasında kalırdı */
  error?: string | null;
  items: CartItem[];
  total: number;
  status: AuthStatus;
  /** Canonical oturum durumu öğrenilmeden sipariş butonu açılmaz */
  hydrated: boolean;
  verificationCode: string | null;
  /** Demoda garson onaylamazsa sistem onaylar; ziyaretçiye söylenir */
  demoAutoApprove: boolean;
  submitting: boolean;
  orderNote: string;
  onOrderNoteChange: (v: string) => void;
  onQty: (productId: string, note: string | undefined, delta: number) => void;
  onSubmit: () => void;
};

const ORDER_LABEL: Readonly<Record<AuthStatus, string>> = {
  VIEW_ONLY: "Sipariş talebi oluştur",
  PENDING: "Garson onayı bekleniyor…",
  AUTHORIZED: "Siparişi gönder",
  REVOKED: "Masa başka oturuma ait",
  TABLE_ALREADY_CLAIMED: "Masa başka oturuma ait",
};

const isClaimedElsewhere = (status: AuthStatus) => status === "REVOKED" || status === "TABLE_ALREADY_CLAIMED";

// Sipariş butonunun duruma göre metni ve etkinliği
function orderButton(status: AuthStatus, hydrated: boolean, submitting: boolean) {
  if (!hydrated) return { label: "Oturum kontrol ediliyor…", disabled: true };
  const blocked = isClaimedElsewhere(status) || status === "PENDING";
  return { label: ORDER_LABEL[status], disabled: blocked || submitting };
}

/** Sepet içeriği: masaüstünde yan panelde, mobilde alttan açılan sayfada aynı bileşen */
export default function CartPanel(p: Props) {
  // Bileşen iki yerde çizildiği için sabit id çakışırdı
  const noteId = useId();
  const btn = orderButton(p.status, p.hydrated, p.submitting);

  return (
    <>
      {p.status === "PENDING" && p.verificationCode && (
        <div className={styles.codeBox}>
          <p className={styles.codeLabel}>Masa doğrulama kodunuz</p>
          <p className={styles.code}>{p.verificationCode}</p>
          <p className={styles.codeHint}>Garson masanıza geldiğinde bu kodu söyleyin.</p>
          {p.demoAutoApprove && (
            <p className={styles.codeHint} role="status">Demo: garson birazdan onaylamazsa sistem onaylayacak.</p>
          )}
        </div>
      )}

      {isClaimedElsewhere(p.status) && (
        <div className={styles.blocked}>
          <p className={styles.blockedTitle}>
            <Lock size={14} aria-hidden="true" /> Bu masa başka bir aktif oturuma ait.
          </p>
          <p className={styles.blockedHint}>Personelden yardım isteyin.</p>
        </div>
      )}

      {p.items.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingBag size={36} aria-hidden="true" />
          <p>Sepetiniz boş</p>
        </div>
      ) : (
        <>
          <ul className={styles.items}>
            {p.items.map((item) => (
              <li key={`${item.product.id}-${item.customerNote ?? ""}`} className={styles.item}>
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.product.name}</p>
                  {item.customerNote && <p className={styles.itemNote}>Not: {item.customerNote}</p>}
                  <p className={styles.itemPrice}>{formatTRY(Number(item.product.price) * item.quantity)}</p>
                </div>
                <div className={styles.qty}>
                  <button
                    type="button"
                    aria-label={`${item.product.name} adedini azalt`}
                    className={`tap-target ${styles.qtyBtn}`}
                    onClick={() => p.onQty(item.product.id, item.customerNote, -1)}
                  >
                    −
                  </button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`${item.product.name} adedini artır`}
                    className={`tap-target ${styles.qtyBtn}`}
                    data-variant="add"
                    onClick={() => p.onQty(item.product.id, item.customerNote, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {p.status === "AUTHORIZED" && (
            <>
              <label htmlFor={noteId} className="sr-only">Sipariş notu</label>
              <textarea
                id={noteId}
                value={p.orderNote}
                onChange={(e) => p.onOrderNoteChange(e.target.value)}
                placeholder="Sipariş notu (isteğe bağlı)"
                className={`input ${styles.orderNote}`}
              />
            </>
          )}
          <div className={styles.total}>
            <span className={styles.totalLabel}>Toplam</span>
            <span className={styles.totalValue}>{formatTRY(p.total)}</span>
          </div>
          <FormError message={p.error} className="mb-3" />
          <button type="button" onClick={p.onSubmit} disabled={btn.disabled} className={`btn btn-primary ${styles.submit}`}>
            {p.submitting ? "Gönderiliyor…" : btn.label}
          </button>
        </>
      )}
    </>
  );
}
