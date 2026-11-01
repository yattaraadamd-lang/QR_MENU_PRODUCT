"use client";

import type { Ref } from "react";
import { BellRing } from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";
import type { AuthStatus, Business, TableInfo } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  business: Business;
  table: TableInfo | null;
  status: AuthStatus;
  onOpenService: () => void;
  /** Yükseklik ölçümü (--header-h) */
  ref?: Ref<HTMLElement>;
};

const STATUS_LABEL: Partial<Record<AuthStatus, string>> = {
  AUTHORIZED: "Aktif",
  PENDING: "Onay bekleniyor",
};

export default function MenuHeader({ business, table, status, onOpenService, ref }: Props) {
  const statusLabel = STATUS_LABEL[status];
  const tableLabel = table?.tableName || `Masa ${table?.tableNumber ?? ""}`.trim();

  return (
    <header ref={ref} className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.identity}>
          <div className={styles.logo}>
            {business.logo ? (
              <img src={business.logo} alt="" width={48} height={48} decoding="async" />
            ) : (
              <BrandMark size={24} />
            )}
          </div>
          <div className={styles.identityText}>
            <h1 className={`font-display ${styles.businessName}`}>{business.name}</h1>
            <div className={styles.meta}>
              <span className={styles.chip}>{tableLabel}</span>
              {statusLabel && (
                <span className={styles.chip} data-status={status}>
                  {statusLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Masaüstü hizmet düğmesi — yalnız AUTHORIZED ise (mobilde alt barda) */}
        {status === "AUTHORIZED" && (
          <div className={styles.headerService}>
            <button type="button" onClick={onOpenService} className={`btn ${styles.headerServiceBtn}`}>
              <BellRing size={16} aria-hidden="true" /> Hizmet
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
