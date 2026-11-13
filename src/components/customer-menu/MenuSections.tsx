"use client";

import ProductCard from "./ProductCard";
import type { Category, Product } from "./types";
import { usePageLoaded } from "./usePageLoaded";
import styles from "./customer-menu.module.css";

// İlk ekranda görünen kart sayısı kadar görsel hemen iner (LCP öğesi bunlardan biri: kartlar
// .stagger ile sırayla açıldığı için Chrome çoğu zaman ikincisini seçiyor). Gerisi sayfa yüklenince
// eklenir ve kaydırdıkça iner (loading="lazy").
const PRIORITY_IMAGES = 2;

type Props = {
  readonly categories: readonly Category[];
  /** Kaydırma takibine bağlanan bölüm ref'i (useScrollSpy) */
  readonly sectionRef: (id: string) => (el: HTMLElement | null) => void;
  readonly onOpen: (product: Product) => void;
  readonly onAdd: (product: Product) => void;
};

/** Kategori bölümleri ve ürün kartları */
export default function MenuSections({ categories, sectionRef, onOpen, onAdd }: Props) {
  const pageLoaded = usePageLoaded();
  let imageIndex = 0;

  return (
    <>
      {categories.map((cat) => (
        <section
          key={cat.id}
          ref={sectionRef(cat.id)}
          data-category-id={cat.id}
          aria-labelledby={`cat-${cat.id}`}
          className={`menu-section ${styles.section}`}
        >
          <h2 id={`cat-${cat.id}`} className={styles.sectionTitle}>
            {cat.icon && <span aria-hidden="true" className={styles.sectionIcon}>{cat.icon}</span>}
            <span className={`font-display ${styles.sectionName}`}>{cat.name}</span>
            <span className={styles.sectionCount}>{cat.products.length} ürün</span>
          </h2>
          <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-4">
            {cat.products.map((p) => {
              const priority = !!p.image && imageIndex++ < PRIORITY_IMAGES;
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  categoryIcon={cat.icon}
                  priority={priority}
                  showImage={priority || pageLoaded}
                  onOpen={onOpen}
                  onAdd={onAdd}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
