"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { DEMO_ROLES } from "./content";
import styles from "./landing.module.css";

interface DemoButtonProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Demo rolü seçme penceresini açan düğme. Landing'in geri kalanı sunucu bileşeni;
 * istemciye yalnız bu düğme ve penceresi iner.
 */
export default function DemoButton({ className, children }: DemoButtonProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog open={open} onClose={close} contentClassName={`modal-content ${styles.demoDialog}`}>
        <div className={styles.demoHead}>
          <div>
            <p className="eyebrow">Canlı demo</p>
            <h2 className={`font-display ${styles.demoTitle}`}>Bir rol seçin</h2>
          </div>
          <button type="button" onClick={close} aria-label="Kapat" className={styles.demoClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ul className={styles.demoList}>
          {DEMO_ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <li key={role.code}>
                <Link href={role.href} prefetch={role.prefetch} onClick={close} className={styles.demoItem}>
                  <span className={styles.demoIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className={styles.demoText}>
                    <span className={styles.demoRole}>{role.role}</span>
                    <span className={styles.demoDesc}>{role.desc}</span>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" className={styles.demoArrow} />
                </Link>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
