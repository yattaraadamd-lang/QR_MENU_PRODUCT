"use client";

import type { Ref, RefObject } from "react";
import type { Category } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Mobil yatay şerit: aktif çip gözlemciden burada ortalanır */
  stripRef: RefObject<HTMLDivElement | null>;
  /** Mobil şerit kutusunun yükseklik ölçümü (--catnav-h); masaüstünde gizli, 0 */
  barRef?: Ref<HTMLDivElement>;
};

export default function CategoryNav({ categories, activeId, onSelect, stripRef, barRef }: Props) {
  return (
    // Mobilde yapışkan olan nav'ın kendisi (iç div'deki sticky, nav şerit kadar yüksek
    // olduğu için tutunmuyordu). Masaüstünde static; oradaki liste kendi sticky'si.
    // top: globals.css .menu-catnav (başlık yüksekliğinden türetilir)
    <nav aria-label="Kategoriler" className="menu-catnav sticky z-30 flex-shrink-0 lg:static lg:w-64">
      {/* sticky sarmalayıcıda: iç kutu kendi kadar yüksek sarmalayıcıda tutunamıyordu */}
      <div className="hidden lg:block sticky menu-side-panel">
        <div className={styles.sideList}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              data-tab-id={cat.id}
              aria-current={activeId === cat.id ? "true" : undefined}
              onClick={() => onSelect(cat.id)}
              className={styles.sideItem}
            >
              {cat.icon && <span aria-hidden="true" className={styles.catIcon}>{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div ref={barRef} className={`lg:hidden ${styles.bar}`}>
        <div ref={stripRef} className={`cat-scroll ${styles.strip}`}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              data-tab-id={cat.id}
              aria-current={activeId === cat.id ? "true" : undefined}
              onClick={() => onSelect(cat.id)}
              className={styles.catChip}
            >
              {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
