"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BottomBar from "@/components/customer-menu/BottomBar";
import CartPanel from "@/components/customer-menu/CartPanel";
import CategoryNav from "@/components/customer-menu/CategoryNav";
import MenuHeader from "@/components/customer-menu/MenuHeader";
import { MenuAccessError, MenuLoading } from "@/components/customer-menu/MenuStatusScreens";
import ProductCard from "@/components/customer-menu/ProductCard";
import ProductSheet from "@/components/customer-menu/ProductSheet";
import ServiceSheet from "@/components/customer-menu/ServiceSheet";
import WaiterSheet from "@/components/customer-menu/WaiterSheet";
import { scrollBehavior } from "@/components/customer-menu/constants";
import { orderable, type MenuResponse, type Product } from "@/components/customer-menu/types";
import { useCart } from "@/components/customer-menu/useCart";
import { useCustomerSession } from "@/components/customer-menu/useCustomerSession";
import { useMenuData } from "@/components/customer-menu/useMenuData";
import { useOrderActions } from "@/components/customer-menu/useOrderActions";
import { useTableActivity } from "@/components/customer-menu/useTableActivity";
import Dialog from "@/components/ui/Dialog";

// İlk ekranda görünen kart sayısı kadar görsel hemen iner, gerisi kaydırınca
const PRIORITY_IMAGES = 2;

export default function CustomerMenuPage({ params }: { params: Promise<{ businessId: string; tableNumber: string }> }) {
  const { businessId, tableNumber } = use(params);
  const session = useCustomerSession(businessId);
  const cart = useCart(businessId, tableNumber);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [orderNote, setOrderNote] = useState("");

  const { prune, add: addItem } = cart;
  const { hydrate } = session;
  const onMenuData = useCallback((data: MenuResponse, initial: boolean) => {
    prune(data.categories);
    if (!initial) return;
    if (data.categories.length > 0) setActiveCategory(data.categories[0].id);
    // Menü hemen gösterilir; oturum arka planda doğrulanır
    hydrate(data.table.id);
  }, [prune, hydrate]);
  const menu = useMenuData(businessId, tableNumber, onMenuData);

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

  const scrollToCategory = (catId: string) => {
    const el = sectionRefs.current[catId];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top: y, behavior: scrollBehavior() });
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
    <div className="customer-theme" style={{ minHeight: "100dvh" }}>
      {session.blockedMsg && !session.token && (
        <div role="alert" style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 16px 0" }}>
          <div style={{
            padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: "rgba(217,68,31,0.12)", color: "#8C2A14", border: "1px solid rgba(217,68,31,0.35)",
          }}>
            ⚠️ {session.blockedMsg}
          </div>
        </div>
      )}

      <MenuHeader business={menu.business} table={menu.table} status={session.status} onOpenService={() => setShowServiceMenu(true)} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }}>
        <div className="flex flex-col lg:flex-row gap-6" style={{ paddingTop: 16 }}>
          <CategoryNav categories={menu.categories} activeId={activeCategory} onSelect={scrollToCategory} stripRef={stripRef} />

          {/* Kolon 2: Ürünler */}
          <main id="main-content" className="flex-1 pb-24 lg:pb-8 pt-0">
            {menu.categories.map(cat => (
              <section
                key={cat.id}
                ref={el => { sectionRefs.current[cat.id] = el; }}
                data-category-id={cat.id}
                aria-labelledby={`cat-${cat.id}`}
                style={{ marginBottom: 40, scrollMarginTop: 160 }}
              >
                <h2 id={`cat-${cat.id}`} style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  {cat.icon && (
                    <span aria-hidden="true" style={{ fontSize: 20, width: 40, height: 40, borderRadius: 12, background: "#FFE9DF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cat.icon}</span>
                  )}
                  <span className="font-display" style={{ flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, background: "var(--bg-hover)", padding: "4px 10px", borderRadius: 99 }}>{cat.products.length} ürün</span>
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
            <div className="bg-white rounded-2xl shadow-md border p-5 sticky" style={{
              background: "var(--bg-card)", borderColor: "var(--border-color)", top: 96,
              maxHeight: "calc(100dvh - 120px)", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                🛒 Sepetim
                {cart.count > 0 && (
                  <span key={cart.count} className="animate-bump" style={{ background: "var(--primary)", color: "white", borderRadius: 99, fontSize: 12, fontWeight: 700, padding: "2px 8px", minWidth: 24, textAlign: "center", display: "inline-block" }}>{cart.count}</span>
                )}
              </h2>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>{renderCart()}</div>
            </div>
          </aside>
        </div>
      </div>

      {selectedProduct && (
        <ProductSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      {showCartMobile && (
        <Dialog onClose={() => setShowCartMobile(false)} overlayClassName="lg:hidden" overlayStyle={{ alignItems: "flex-end" }} contentClassName="modal-content modal-sheet" contentStyle={{ borderRadius: "20px 20px 0 0", margin: 0, maxWidth: 600, padding: 0 }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1, borderRadius: "20px 20px 0 0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>🛒 Sepetim</h2>
            <button type="button" aria-label="Kapat" className="tap-target" onClick={() => setShowCartMobile(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ padding: "12px 20px 20px", maxHeight: "70dvh", overflowY: "auto" }}>{renderCart(actions.actionError)}</div>
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
