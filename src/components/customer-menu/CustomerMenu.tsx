"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import BottomBar from "@/components/customer-menu/BottomBar";
import CartPanel from "@/components/customer-menu/CartPanel";
import CategoryNav from "@/components/customer-menu/CategoryNav";
import MenuHeader from "@/components/customer-menu/MenuHeader";
import { MenuAccessError, MenuLoading } from "@/components/customer-menu/MenuStatusScreens";
import ProductCard from "@/components/customer-menu/ProductCard";
import ProductSheet from "@/components/customer-menu/ProductSheet";
import ServiceSheet from "@/components/customer-menu/ServiceSheet";
import SheetHeader from "@/components/customer-menu/SheetHeader";
import WaiterSheet from "@/components/customer-menu/WaiterSheet";
import styles from "@/components/customer-menu/customer-menu.module.css";
import { scrollBehavior } from "@/components/customer-menu/constants";
import { orderable, type MenuResponse, type Product } from "@/components/customer-menu/types";
import { useCart } from "@/components/customer-menu/useCart";
import { useCustomerSession } from "@/components/customer-menu/useCustomerSession";
import { useMenuData } from "@/components/customer-menu/useMenuData";
import { useOrderActions } from "@/components/customer-menu/useOrderActions";
import { useTableActivity } from "@/components/customer-menu/useTableActivity";
import Dialog from "@/components/ui/Dialog";
import { useCssHeightVar } from "@/hooks/useCssHeightVar";

// İlk ekranda görünen kart sayısı kadar görsel hemen iner, gerisi kaydırınca
const PRIORITY_IMAGES = 2;

type Props = {
  businessId: string;
  tableNumber: string;
  /** Sunucuda çizilen ilk menü (app/menu/.../page.tsx) ve ETag'i: ilk HTML'de menü hazır gelir */
  initialMenu?: { data: MenuResponse; etag: string };
};

export default function CustomerMenu({ businessId, tableNumber, initialMenu }: Props) {
  const session = useCustomerSession(businessId);
  const cart = useCart(businessId, tableNumber);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  // Kapatılan uyarı metni: aynı uyarı geri gelmez, yeni bir uyarı yine gösterilir
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);

  const { prune, add: addItem } = cart;
  const { hydrate } = session;
  const onMenuData = useCallback((data: MenuResponse, initial: boolean) => {
    prune(data.categories);
    if (!initial) return;
    if (data.categories.length > 0) setActiveCategory(data.categories[0].id);
    // Menü hemen gösterilir; oturum arka planda doğrulanır
    hydrate(data.table.id);
  }, [prune, hydrate]);
  const menu = useMenuData(businessId, tableNumber, onMenuData, initialMenu);

  const activity = useTableActivity({
    businessId: menu.business?.id,
    tableId: menu.table?.id,
    token: session.token,
    status: session.status,
    onVerificationCode: session.setVerificationCode,
  });

  const actions = useOrderActions({
    routeBusinessId: businessId,
    business: menu.business,
    table: menu.table,
    session,
    cart,
    orderNote,
    activeRequests: activity.activeRequests,
    onOrderSent: () => { setOrderNote(""); setShowCartMobile(false); },
    onRequestSent: () => { setShowServiceMenu(false); setShowWaiterModal(false); },
    refreshMenu: menu.refresh,
    refreshRequests: activity.refreshRequests,
  });

  // Hata yalnız açık pencerede tutulur (toast modalın arkasında kalırdı); pencereler kapanınca silinir
  const dialogOpen = showCartMobile || showServiceMenu || showWaiterModal;
  const { clearError } = actions;
  useEffect(() => { if (!dialogOpen) clearError(); }, [dialogOpen, clearError]);

  const addToCart = useCallback((p: Product, note?: string) => {
    if (!orderable(p)) { toast.error("Bu ürün şu anda mevcut değil"); return; }
    addItem(p, note);
    toast.success(`${p.name} sepete eklendi`);
  }, [addItem]);

  // Yapışkan başlık, mobil kategori şeridi ve alt bar ölçülür; ofsetler (sticky top,
  // scroll-margin, alt boşluk) sabit sayı yerine bu değişkenleri kullanır (.menu-shell)
  const headerRef = useCssHeightVar("--header-h");
  const catBarRef = useCssHeightVar("--catnav-h");
  const bottomBarRef = useCssHeightVar("--bottombar-h");

  // ── Kaydırırken aktif kategori ──
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu.categories.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const catId = entry.target.getAttribute("data-category-id");
        if (!catId) return;
        setActiveCategory(catId);
        // Sekmeyi şeridin içinde ara: masaüstü listesi DOM'da önce gelir ve
        // mobilde display:none olduğundan offsetLeft'i 0'dır
        const container = stripRef.current;
        const tab = container?.querySelector<HTMLElement>(`[data-tab-id="${catId}"]`);
        if (container && tab && container.offsetParent !== null) {
          const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
          container.scrollTo({ left: scrollLeft, behavior: scrollBehavior() });
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
    menu.categories.forEach((cat) => {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [menu.categories]);

  // Bölümün scroll-margin-top'u yapışkan başlık + şerit kadar: başlığın altında durur
  const scrollToCategory = (catId: string) => {
    sectionRefs.current[catId]?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
  };

  if (menu.loading) return <MenuLoading />;
  if (menu.error || !menu.business) return <MenuAccessError message={menu.error || "Bu sayfa bulunamadı."} />;

  const renderCart = (error?: string | null) => (
    <CartPanel
      error={error}
      items={cart.items}
      total={cart.total}
      status={session.status}
      hydrated={session.hydrated}
      verificationCode={session.verificationCode}
      submitting={actions.submitting}
      orderNote={orderNote}
      onOrderNoteChange={setOrderNote}
      onQty={cart.updateQty}
      onSubmit={actions.submitOrder}
    />
  );

  let imageIndex = 0;

  return (
    <div className="customer-theme menu-shell min-h-viewport" data-height-vars>
      {/* Akış dışında (globals.css .menu-notice): oturum yanıtı sonradan geldiği için en üste
          eklenen uyarı tüm menüyü aşağı itiyordu (320px'de CLS 0,107). Menü okunurken araya
          girmesin diye alert değil status. */}
      {session.blockedMsg && !session.token && session.blockedMsg !== dismissedNotice && (
        <div role="status" className="menu-notice animate-slide-up">
          <p style={{ flex: 1 }}>{session.blockedMsg}</p>
          <button type="button" aria-label="Uyarıyı kapat" className="tap-target" onClick={() => setDismissedNotice(session.blockedMsg)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <MenuHeader ref={headerRef} business={menu.business} table={menu.table} status={session.status} onOpenService={() => setShowServiceMenu(true)} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }}>
        <div className="flex flex-col lg:flex-row gap-6" style={{ paddingTop: 16 }}>
          <CategoryNav categories={menu.categories} activeId={activeCategory} onSelect={scrollToCategory} stripRef={stripRef} barRef={catBarRef} />

          {/* Kolon 2: Ürünler — alt boşluk alt bar kadar (canlı adisyon satırıyla uzar) */}
          <main id="main-content" className="flex-1 pt-0" style={{ paddingBottom: "calc(var(--bottombar-h) + 24px)" }}>
            {menu.categories.map(cat => (
              <section
                key={cat.id}
                ref={el => { sectionRefs.current[cat.id] = el; }}
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
                  {cat.products.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      categoryIcon={cat.icon}
                      priority={!!p.image && imageIndex++ < PRIORITY_IMAGES}
                      onOpen={setSelectedProduct}
                      onAdd={addToCart}
                    />
                  ))}
                </div>
              </section>
            ))}
          </main>

          {/* Kolon 3: Sepet (masaüstü) */}
          <aside aria-label="Sepet" className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className={`sticky menu-side-panel ${styles.cartAside}`}>
              <h2 className={`font-display ${styles.cartTitle}`}>
                Sepetim
                {cart.count > 0 && (
                  <span key={cart.count} className={`animate-bump ${styles.cartCount}`}>{cart.count}</span>
                )}
              </h2>
              <div className={styles.cartScroll}>{renderCart()}</div>
            </div>
          </aside>
        </div>
      </div>

      {selectedProduct && (
        <ProductSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      {showCartMobile && (
        <Dialog onClose={() => setShowCartMobile(false)} overlayClassName="lg:hidden" overlayStyle={{ alignItems: "flex-end" }} contentClassName={`modal-content modal-sheet ${styles.sheet}`} contentStyle={{ paddingBottom: 0 }}>
          <SheetHeader title="Sepetim" onClose={() => setShowCartMobile(false)} />
          <div className={styles.sheetScroll}>{renderCart(actions.actionError)}</div>
        </Dialog>
      )}

      {showWaiterModal && (
        <WaiterSheet
          error={actions.actionError}
          onClose={() => setShowWaiterModal(false)}
          onSubmit={(reason) => actions.sendRequest("CALL_WAITER", reason)}
          sending={actions.sendingRequest}
        />
      )}

      {showServiceMenu && (
        <ServiceSheet
          activeRequests={activity.activeRequests}
          sending={actions.sendingRequest}
          error={actions.actionError}
          onClose={() => setShowServiceMenu(false)}
          onCallWaiter={() => { clearError(); setShowServiceMenu(false); setShowWaiterModal(true); }}
          onPayment={() => actions.sendRequest("PAYMENT_REQUEST")}
          onHelp={() => actions.sendRequest("HELP_REQUEST")}
        />
      )}

      <BottomBar
        ref={bottomBarRef}
        status={session.status}
        liveBill={activity.liveBill}
        activeCount={activity.activeCount}
        cartCount={cart.count}
        cartTotal={cart.total}
        onOpenService={() => setShowServiceMenu(true)}
        onOpenCart={() => setShowCartMobile(true)}
      />
    </div>
  );
}
