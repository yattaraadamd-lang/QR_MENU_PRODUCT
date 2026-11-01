"use client";

import { ChevronRight, CreditCard, Hand, Info, type LucideIcon } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import FormError from "@/components/ui/FormError";
import SheetHeader from "./SheetHeader";
import type { ActiveRequests } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  activeRequests: ActiveRequests;
  sending: boolean;
  /** Talep gönderilemediyse pencerenin içinde gösterilir (toast modalın arkasında kalırdı) */
  error: string | null;
  onClose: () => void;
  onCallWaiter: () => void;
  onPayment: () => void;
  onHelp: () => void;
};

interface ServiceOption {
  readonly type: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly desc: string;
  readonly action: () => void;
  readonly blocked: boolean;
  readonly activeMsg?: string;
}

/** Hizmet talepleri menüsü: garson çağır, ödeme iste, yardım iste */
export default function ServiceSheet({ activeRequests, sending, error, onClose, onCallWaiter, onPayment, onHelp }: Props) {
  const options: readonly ServiceOption[] = [
    {
      type: "CALL_WAITER", icon: Hand, title: "Garson çağır", desc: "Garsonun masanıza gelmesini sağlayın",
      action: onCallWaiter,
      blocked: !!(activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"]),
      activeMsg: activeRequests["CALL_WAITER"] ? "Çağrınız iletildi, bekleniyor…" : undefined,
    },
    {
      type: "PAYMENT_REQUEST", icon: CreditCard, title: "Ödeme iste", desc: "Hesabınızı kapatmak için garson çağırın",
      action: onPayment,
      blocked: !!(activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"]) || sending,
      activeMsg: activeRequests["PAYMENT_REQUEST"] ? "Ödeme talebiniz iletildi, bekleniyor…" : undefined,
    },
    {
      type: "HELP_REQUEST", icon: Info, title: "Yardım iste", desc: "Bilgi veya destek talebi oluşturun",
      action: onHelp,
      blocked: false,
    },
  ];

  return (
    <Dialog onClose={onClose} overlayStyle={{ alignItems: "flex-end" }} contentClassName={`modal-content modal-sheet ${styles.sheet}`}>
      <SheetHeader title="Hizmet talepleri" onClose={onClose} />
      <div className={styles.serviceList}>
        {options.map((option) => {
          const unavailable = option.blocked || sending;
          const Icon = option.icon;
          return (
            // aria-disabled: odaklanabilir kalır, ekran okuyucu durumunu "bekliyor" metniyle birlikte okur
            <button
              key={option.type}
              type="button"
              className={`service-btn ${styles.serviceItem}`}
              aria-disabled={unavailable || undefined}
              onClick={unavailable ? undefined : option.action}
            >
              <span className={styles.serviceIcon}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className={styles.serviceText}>
                <span className={styles.serviceTitle}>{option.title}</span>
                <span className={styles.serviceDesc}>{option.activeMsg || option.desc}</span>
              </span>
              {option.blocked ? (
                <span className={styles.serviceWait}>Bekliyor</span>
              ) : (
                <ChevronRight size={18} aria-hidden="true" className={styles.serviceArrow} />
              )}
            </button>
          );
        })}
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
