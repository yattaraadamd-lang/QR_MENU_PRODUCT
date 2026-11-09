"use client";

import { X } from "lucide-react";
import BottomBar from "@/components/customer-menu/BottomBar";
import CartPanel from "@/components/customer-menu/CartPanel";
import CategoryNav from "@/components/customer-menu/CategoryNav";
import MenuHeader from "@/components/customer-menu/MenuHeader";
import MenuSections from "@/components/customer-menu/MenuSections";
import MenuSheet from "@/components/customer-menu/MenuSheet";
import { MenuAccessError, MenuLoading } from "@/components/customer-menu/MenuStatusScreens";
import ProductSheet from "@/components/customer-menu/ProductSheet";
import ServiceSheet from "@/components/customer-menu/ServiceSheet";
import SheetHeader from "@/components/customer-menu/SheetHeader";
import WaiterSheet from "@/components/customer-menu/WaiterSheet";
import styles from "@/components/customer-menu/customer-menu.module.css";
import type { MenuResponse } from "@/components/customer-menu/types";
import { useCustomerMenu } from "@/components/customer-menu/useCustomerMenu";
import { useCssHeightVar } from "@/hooks/useCssHeightVar";

type Props = {
  businessId: string;
  tableNumber: string;
  /** Sunucuda çizilen ilk menü (app/menu/.../page.tsx) ve ETag'i: ilk HTML'de menü hazır gelir */
  initialMenu?: { data: MenuResponse; etag: string };
};

/** Müşteri menüsünün düzeni; davranış useCustomerMenu'de (FE-ARCH-2.4) */
export default function CustomerMenu({ businessId, tableNumber, initialMenu }: Props) {
  const view = useCustomerMenu(businessId, tableNumber, initialMenu);
  const { menu, session, cart, activity, actions, spy } = view;

  // Yapışkan başlık, mobil kategori şeridi ve alt bar ölçülür; ofsetler (sticky top,
  // scroll-margin, alt boşluk) sabit sayı yerine bu değişkenleri kullanır (.menu-shell)
  const headerRef = useCssHeightVar("--header-h");
  const catBarRef = useCssHeightVar("--catnav-h");
  const bottomBarRef = useCssHeightVar("--bottombar-h");

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
      demoAutoApprove={session.demoAutoApprove}
      submitting={actions.submitting}
      orderNote={view.orderNote}
      onOrderNoteChange={view.setOrderNote}
      onQty={cart.updateQty}
      onSubmit={actions.submitOrder}
    />
  );

  return (
    <div className="customer-theme menu-shell min-h-viewport" data-height-vars>
      {/* Akış dışında (globals.css .menu-notice): oturum yanıtı sonradan geldiği için en üste
          eklenen uyarı tüm menüyü aşağı itiyordu (320px'de CLS 0,107). Menü okunurken araya
          girmesin diye alert değil status. */}
      {session.blockedMsg && !session.token && session.blockedMsg !== view.dismissedNotice && (
        <div role="status" className="menu-notice animate-slide-up">
          <p className="flex-1">{session.blockedMsg}</p>
          <button type="button" aria-label="Uyarıyı kapat" className="tap-target" onClick={() => view.setDismissedNotice(session.blockedMsg)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <MenuHeader ref={headerRef} business={menu.business} table={menu.table} status={session.status} onOpenService={view.openService} />

      <div className="mx-auto max-w-screen-xl px-4">
        <div className="flex flex-col gap-6 pt-4 lg:flex-row">
          <CategoryNav categories={menu.categories} activeId={spy.activeId} onSelect={spy.scrollTo} stripRef={spy.stripRef} barRef={catBarRef} />

          {/* Kolon 2: Ürünler — alt boşluk alt bar kadar (canlı adisyon satırıyla uzar) */}
          <main id="main-content" className="flex-1 pb-[calc(var(--bottombar-h)+24px)]">
            <MenuSections categories={menu.categories} sectionRef={spy.sectionRef} onOpen={view.setSelectedProduct} onAdd={view.addToCart} />
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

      {view.selectedProduct && (
        <ProductSheet product={view.selectedProduct} onClose={() => view.setSelectedProduct(null)} onAdd={view.addToCart} />
      )}

      {view.sheets.cart && (
        <MenuSheet onClose={view.closeCart} flush>
          <SheetHeader title="Sepetim" onClose={view.closeCart} />
          <div className={styles.sheetScroll}>{renderCart(view.actionError)}</div>
        </MenuSheet>
      )}

      {view.sheets.waiter && (
        <WaiterSheet
          error={view.actionError}
          onClose={view.closeWaiter}
          onSubmit={(reason) => actions.sendRequest("CALL_WAITER", reason)}
          sending={actions.sendingRequest}
        />
      )}

      {view.sheets.service && (
        <ServiceSheet
          activeRequests={activity.activeRequests}
          sending={actions.sendingRequest}
          error={view.actionError}
          onClose={view.closeService}
          onCallWaiter={view.callWaiter}
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
        onOpenService={view.openService}
        onOpenCart={view.openCart}
      />
    </div>
  );
}
