"use client";

import type { Ref } from "react";
import { BellRing, ReceiptText, ShoppingBag } from "lucide-react";
import { formatTRY } from "@/lib/format";
import type { AuthStatus, LiveBill } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  status: AuthStatus;
  liveBill: LiveBill;
  activeCount: number;
  cartCount: number;
  cartTotal: number;
  onOpenService: () => void;
  onOpenCart: () => void;
  /** Yükseklik ölçümü (--bottombar-h): menünün alt boşluğu bar kadar olur */
  ref?: Ref<HTMLDivElement>;
};

/** Mobil alt bar: canlı adisyon, hizmet menüsü ve sepet */
export default function BottomBar({ status, liveBill, activeCount, cartCount, cartTotal, onOpenService, onOpenCart, ref }: Props) {
  const authorized = status === "AUTHORIZED";
  const remaining = (liveBill.total ?? 0) - liveBill.paid;
  const showBill = authorized && liveBill.total !== null && liveBill.total > 0;

  return (
    <div ref={ref} className={styles.bottomBar}>
      {showBill && (
        <div className={styles.bill}>
          <span className={styles.billLabel}>
            <ReceiptText size={14} aria-hidden="true" /> Adisyon
          </span>
          <span className={styles.billAmounts}>
            {liveBill.paid > 0 && <span className={styles.billPaid}>{formatTRY(liveBill.paid)} ödendi</span>}
            <span className={styles.billDue} data-settled={remaining <= 0}>
              {remaining > 0 ? formatTRY(remaining) : "Ödendi"}
            </span>
          </span>
        </div>
      )}
      <div className={styles.barActions}>
        {authorized && (
          <button
            type="button"
            onClick={onOpenService}
            aria-label={activeCount > 0 ? `Hizmet, ${activeCount} bekleyen talep` : "Hizmet"}
            className={styles.barService}
          >
            <BellRing size={20} aria-hidden="true" />
            <span>Hizmet</span>
            {activeCount > 0 && (
              <span aria-hidden="true" className={`animate-pulse-soft ${styles.barBadge}`}>
                {activeCount}
              </span>
            )}
          </button>
        )}
        <button type="button" onClick={onOpenCart} disabled={cartCount === 0} className={styles.barCart}>
          {cartCount > 0 ? (
            <>
              <span key={cartCount} className={`animate-bump ${styles.barCount}`}>{cartCount}</span>
              Sepet · {formatTRY(cartTotal)}
            </>
          ) : (
            <>
              <ShoppingBag size={18} aria-hidden="true" /> Sepet boş
            </>
          )}
        </button>
      </div>
    </div>
  );
}
