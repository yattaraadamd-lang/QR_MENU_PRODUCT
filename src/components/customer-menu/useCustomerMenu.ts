"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orderable, type MenuResponse, type Product } from "./types";
import { useCart } from "./useCart";
import { useCustomerSession } from "./useCustomerSession";
import { useMenuData } from "./useMenuData";
import { useOrderActions, type ActionNotifier } from "./useOrderActions";
import { useScrollSpy } from "./useScrollSpy";
import { useTableActivity } from "./useTableActivity";

/**
 * Müşteri menüsünün denetleyicisi (FE-ARCH-2.4): oturum, sepet, menü, masa etkinliği ve eylem
 * hook'larını birbirine bağlar; pencere durumu ve kullanıcıya gösterim (toast ya da açık
 * pencerenin içinde hata) burada. CustomerMenu yalnız düzeni çizer.
 */
export function useCustomerMenu(businessId: string, tableNumber: string, initialMenu?: { data: MenuResponse; etag: string }) {
  const session = useCustomerSession(businessId, {
    onAuthorized: () => toast.success("Masanız açıldı! Siparişinizi gönderebilirsiniz. ✅"),
    onRequestExpired: () => toast.info("Talebinizin süresi doldu. Siparişinizi yeniden gönderebilirsiniz."),
  });
  const cart = useCart(businessId, tableNumber);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showService, setShowService] = useState(false);
  const [showWaiter, setShowWaiter] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  // Kapatılan uyarı metni: aynı uyarı geri gelmez, yeni bir uyarı yine gösterilir
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  // Eylem hatası yalnız açık pencerede tutulur; pencere kapanınca silinir
  const [actionError, setActionError] = useState<string | null>(null);

  const { prune, add: addItem } = cart;
  const { hydrate } = session;
  const onMenuData = useCallback((data: MenuResponse, initial: boolean) => {
    prune(data.categories);
    // Menü hemen gösterilir; oturum arka planda doğrulanır
    if (initial) hydrate(data.table.id);
  }, [prune, hydrate]);
  const menu = useMenuData(businessId, tableNumber, onMenuData, initialMenu);
  const spy = useScrollSpy(menu.categories);

  const activity = useTableActivity({
    businessId: menu.business?.id,
    tableId: menu.table?.id,
    token: session.token,
    status: session.status,
    onVerificationCode: session.setVerificationCode,
  });

  const notify: ActionNotifier = {
    success: (message) => toast.success(message),
    // Açık <dialog> (top layer) varken toast modalın arkasında kalır: hata pencerenin içinde
    error: (message) => (document.querySelector("dialog[open]") ? setActionError(message) : toast.error(message)),
    clear: () => setActionError(null),
  };

  const closeCart = () => {
    setShowCart(false);
    setActionError(null);
  };
  const closeService = () => {
    setShowService(false);
    setActionError(null);
  };
  const closeWaiter = () => {
    setShowWaiter(false);
    setActionError(null);
  };

  const actions = useOrderActions({
    notify,
    routeBusinessId: businessId,
    business: menu.business,
    table: menu.table,
    session,
    cart,
    orderNote,
    activeRequests: activity.activeRequests,
    onOrderSent: () => {
      setOrderNote("");
      closeCart();
    },
    onRequestSent: () => {
      closeService();
      closeWaiter();
    },
    refreshMenu: menu.refresh,
    refreshRequests: activity.refreshRequests,
  });

  const addToCart = useCallback((p: Product, note?: string) => {
    if (!orderable(p)) {
      toast.error("Bu ürün şu anda mevcut değil");
      return;
    }
    addItem(p, note);
    toast.success(`${p.name} sepete eklendi`);
  }, [addItem]);

  return {
    menu,
    session,
    cart,
    activity,
    actions,
    spy,
    selectedProduct,
    setSelectedProduct,
    orderNote,
    setOrderNote,
    dismissedNotice,
    setDismissedNotice,
    actionError,
    addToCart,
    sheets: { cart: showCart, service: showService, waiter: showWaiter },
    openCart: () => setShowCart(true),
    openService: () => setShowService(true),
    closeCart,
    closeService,
    closeWaiter,
    // Hizmet menüsünden garson çağırma penceresine geçiş
    callWaiter: () => {
      setActionError(null);
      setShowService(false);
      setShowWaiter(true);
    },
  };
}
