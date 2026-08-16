"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { v4 as uuidv4 } from "uuid";

type Product = {
  id: string; name: string; description: string | null;
  ingredients: string | null; allergens: string | null;
  price: number; image: string | null;
  isAvailable: boolean; stockStatus: string; isPopular: boolean;
};
type Category = { id: string; name: string; icon: string | null; products: Product[] };
type CartItem = { product: Product; quantity: number; customerNote?: string };
type Business = { id: string; name: string; description: string | null; logo: string | null; phone: string | null };
type TableInfo = { id: string; tableNumber: string; tableName: string | null };

const WAITER_REASONS = [
  "Sipariş vermek istiyorum",
  "Masa kirli",
  "Siparişim gecikti",
  "Ekstra peçete istiyorum",
  "Çatal / kaşık / bıçak istiyorum",
  "Genel yardım istiyorum",
  "Diğer",
];

const BRAND = "#B91C1C";
const BRAND_DARK = "#991B1B";

type AuthStatus = "VIEW_ONLY" | "PENDING" | "AUTHORIZED" | "REVOKED" | "TABLE_ALREADY_CLAIMED";

export default function CustomerMenuPage({ params }: { params: Promise<{ businessId: string; tableNumber: string }> }) {
  const resolvedParams = use(params);
  const [business, setBusiness] = useState<Business | null>(null);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [waiterReason, setWaiterReason] = useState("");
  const [waiterNote, setWaiterNote] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [orderBlockedMsg, setOrderBlockedMsg] = useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<Record<string, boolean>>({});
  const [requestDetails, setRequestDetails] = useState<Record<string, any>>({});

  // ✅ Yetki durumu yönetimi
  const [authStatus, setAuthStatus] = useState<AuthStatus>("VIEW_ONLY");
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [pendingRequestExpiresAt, setPendingRequestExpiresAt] = useState<string | null>(null);

  // ✅ Canonical session hydration — UI butonu canonical durum öğrenilmeden aktif olmaz
  const [sessionStateHydrated, setSessionStateHydrated] = useState(false);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const authPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard: prevent multiple concurrent canonical sync requests
  const syncInFlightRef = useRef(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ✅ Masa bazlı localStorage token yönetimi
  const getStorageKey = useCallback(() => {
    if (!business?.id || !table?.id) return null;
    return `qr_session_${business.id}_${table.id}`;
  }, [business?.id, table?.id]);

  const ensureCustomerSession = useCallback(async (tableId: string): Promise<string | null> => {
    const storageKey = `qr_session_${resolvedParams.businessId}_${tableId}`;

    // localStorage'dan oku (masa bazlı)
    const stored = localStorage.getItem(storageKey);
    // Eski global anahtarı da kontrol et (geriye uyumluluk)
    const oldStored = sessionStorage.getItem("qr_session_token") || localStorage.getItem("qr_session_token");

    const existingToken = stored || oldStored;

    if (existingToken) {
      // ✅ FIX: Token doğrulamayı canonical status endpoint ile yap (URL query değil header)
      try {
        const checkRes = await fetch("/api/customer/session/status", {
          headers: { "x-session-token": existingToken },
          cache: "no-store",
        });
        const checkData = await checkRes.json();
        if (checkData.valid) {
          // Route-table eşleşme kontrolü
          if (checkData.businessId !== resolvedParams.businessId || checkData.tableId !== tableId) {
            // Başka masaya ait token — kullanma
            localStorage.removeItem(storageKey);
          } else {
            // Yeni anahtara taşı
            localStorage.setItem(storageKey, existingToken);
            sessionStorage.removeItem("qr_session_token");
            localStorage.removeItem("qr_session_token");

            setSessionToken(existingToken);
            setOrderBlockedMsg(null);
            if (checkData.authorizationStatus) {
              setAuthStatus(checkData.authorizationStatus as AuthStatus);
            }
            setSessionStateHydrated(true);
            return existingToken;
          }
        } else if (checkData.code === "SESSION_REVOKED") {
          setAuthStatus("REVOKED");
          localStorage.removeItem(storageKey);
          setSessionStateHydrated(true);
        }
      } catch { /* devam et */ }
    }

    const qrToken = sessionStorage.getItem("qr_token");
    if (!qrToken) {
      setOrderBlockedMsg("Sipariş vermek için masadaki QR kodu okutmanız gerekir.");
      setSessionStateHydrated(true);
      return null;
    }

    try {
      const sr = await fetch("/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: resolvedParams.businessId,
          tableId,
          qrToken,
          existingToken: existingToken || undefined,
        }),
      });
      const sd = await sr.json();
      if (sr.ok && sd.sessionToken) {
        localStorage.setItem(storageKey, sd.sessionToken);
        sessionStorage.removeItem("qr_session_token");
        sessionStorage.removeItem("qr_order_blocked_msg");
        setSessionToken(sd.sessionToken);
        setOrderBlockedMsg(null);
        if (sd.authorizationStatus) {
          setAuthStatus(sd.authorizationStatus as AuthStatus);
        }
        setSessionStateHydrated(true);
        return sd.sessionToken;
      }
      const msg = sd.message || sd.error || "Sipariş vermek için masadaki QR kodu tekrar okutun.";
      setOrderBlockedMsg(msg);
      setSessionStateHydrated(true);
      return null;
    } catch {
      setOrderBlockedMsg("Oturum oluşturulamadı. Lütfen QR kodu tekrar okutun.");
      setSessionStateHydrated(true);
      return null;
    }
  }, [resolvedParams.businessId]);

  // ✅ Canonical session status helper — tek canonical okuma noktası
  const fetchCanonicalSessionStatus = useCallback(
    async (token: string) => {
      const res = await fetch("/api/customer/session/status", {
        method: "GET",
        headers: { "x-session-token": token },
        cache: "no-store",
      });
      const data = await res.json();
      return {
        ok: res.ok,
        status: data.authorizationStatus as AuthStatus | undefined,
        tableSessionId: data.tableSessionId as string | undefined,
        customerSessionId: data.customerSessionId as string | undefined,
        businessId: data.businessId as string | undefined,
        tableId: data.tableId as string | undefined,
        orderRequestStatus: data.orderRequestStatus as string | null | undefined,
        code: data.code as string | undefined,
      };
    },
    []
  );

  // ✅ PENDING durumunda canonical polling (1.5 s)
  useEffect(() => {
    if (authStatus !== "PENDING" || !sessionToken) return;

    let cancelled = false;

    const sync = async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        const result = await fetchCanonicalSessionStatus(sessionToken);
        if (cancelled) return;

        if (result.status === "AUTHORIZED") {
          setAuthStatus("AUTHORIZED");
          setVerificationCode(null);
          setPendingRequestExpiresAt(null);
          showToast("Masanız açıldı! Siparişinizi gönderebilirsiniz. ✅");
        } else if (result.status === "REVOKED") {
          setAuthStatus("REVOKED");
        }
      } catch { /* network error — next poll will retry */ }
      finally { syncInFlightRef.current = false; }
    };

    sync();
    const timer = window.setInterval(sync, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authStatus, sessionToken, fetchCanonicalSessionStatus]);

  // ✅ window focus / visibilitychange / online — anlık canonical sync
  useEffect(() => {
    if (!sessionToken) return;

    const instantSync = () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      fetchCanonicalSessionStatus(sessionToken)
        .then((result) => {
          if (result.status && result.status !== authStatus) {
            setAuthStatus(result.status);
            if (result.status === "AUTHORIZED") {
              setVerificationCode(null);
              setPendingRequestExpiresAt(null);
            }
          }
        })
        .catch(() => {})
        .finally(() => { syncInFlightRef.current = false; });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") instantSync();
    };

    window.addEventListener("focus", instantSync);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", instantSync);

    return () => {
      window.removeEventListener("focus", instantSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", instantSync);
    };
  }, [sessionToken, authStatus, fetchCanonicalSessionStatus]);

  const fetchMenu = useCallback(async (initial = false) => {
    try {
      const res = await fetch(`/api/menu/${resolvedParams.businessId}/${resolvedParams.tableNumber}`);
      const data = await res.json();
      if (res.ok) {
        setBusiness(data.business);
        setTable(data.table);
        setCategories(data.categories || []);
        if (initial && data.categories?.length > 0) setActiveCategory(data.categories[0].id);

        // ✅ Cart içindeki stoksuz kalan ürünleri otomatik temizle
        setCart(prevCart => {
          if (prevCart.length === 0) return prevCart;
          const allProductsMap = new Map<string, Product>();
          (data.categories || []).forEach((cat: Category) => {
            (cat.products || []).forEach((p: Product) => allProductsMap.set(p.id, p));
          });

          const validCart = prevCart.filter(item => {
            const updatedProd = allProductsMap.get(item.product.id);
            if (!updatedProd) return false;
            return updatedProd.isAvailable && updatedProd.stockStatus === "IN_STOCK";
          });

          if (validCart.length < prevCart.length) {
            showToast("Stokta tükenen ürünler sepetinizden çıkarıldı.", "err");
          }
          return validCart;
        });
        if (initial) {
          const blockedHint = sessionStorage.getItem("qr_order_blocked_msg");
          if (blockedHint) setOrderBlockedMsg(blockedHint);

          // ✅ Masa bazlı localStorage'dan token al + canonical status ile hydrate
          const storageKey = `qr_session_${data.business.id}_${data.table.id}`;
          const storedToken = localStorage.getItem(storageKey) || sessionStorage.getItem("qr_session_token");
          if (storedToken) {
            // ✅ FIX: Önce canonical status endpoint ile doğrula, sonra state güncelle
            try {
              const canonRes = await fetch("/api/customer/session/status", {
                headers: { "x-session-token": storedToken },
                cache: "no-store",
              });
              const canonData = await canonRes.json();
              if (canonData.valid) {
                // Route-table eşleşme kontrolü
                if (canonData.businessId !== resolvedParams.businessId || canonData.tableId !== data.table.id) {
                  // Başka masaya ait token — kullanma
                  localStorage.removeItem(storageKey);
                  await ensureCustomerSession(data.table.id);
                } else {
                  setSessionToken(storedToken);
                  setOrderBlockedMsg(null);
                  sessionStorage.removeItem("qr_order_blocked_msg");
                  localStorage.setItem(storageKey, storedToken);
                  sessionStorage.removeItem("qr_session_token");
                  if (canonData.authorizationStatus) {
                    setAuthStatus(canonData.authorizationStatus as AuthStatus);
                  }
                  // Pending ORDER_REQUEST varsa verificationCode'u koru
                  if (canonData.orderRequestStatus === "PENDING" || canonData.orderRequestStatus === "SEEN") {
                    setAuthStatus("PENDING");
                  }
                  setSessionStateHydrated(true);
                }
              } else if (canonData.code === "SESSION_REVOKED") {
                setAuthStatus("REVOKED");
                localStorage.removeItem(storageKey);
                setSessionStateHydrated(true);
              } else {
                // Token geçersiz — yeni oturum oluştur
                localStorage.removeItem(storageKey);
                await ensureCustomerSession(data.table.id);
              }
            } catch {
              // Network error — tokeni koru, sonra tekrar dene
              setSessionToken(storedToken);
              setSessionStateHydrated(true);
            }
          } else {
            await ensureCustomerSession(data.table.id);
          }
        }
      } else {
        if (initial) setSessionError(data.error || "Menü yüklenemedi.");
      }
    } catch { if (initial) setSessionError("Bağlantı hatası."); }
    finally { if (initial) setLoading(false); }
  }, [resolvedParams.businessId, resolvedParams.tableNumber, ensureCustomerSession]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMenu(true); }, [fetchMenu]);
  useEffect(() => { const iv = setInterval(() => fetchMenu(false), 5000); return () => clearInterval(iv); }, [fetchMenu]);

  const checkActiveRequests = useCallback(async () => {
    if (!table?.id || !business?.id) return;
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers["x-session-token"] = sessionToken;

      const res = await fetch(`/api/customer/active-requests?tableId=${table.id}&businessId=${business.id}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRequests(data.activeRequests || {});
        if (data.requestDetails) {
          setRequestDetails(data.requestDetails);
          // ORDER_REQUEST detayları varsa güncelle
          if (data.requestDetails.ORDER_REQUEST) {
            const detail = data.requestDetails.ORDER_REQUEST;
            if (detail.verificationCode) setVerificationCode(detail.verificationCode);
            if (detail.expiresAt) setPendingRequestExpiresAt(detail.expiresAt);
          }
        }
      }
    } catch { /* sessiz hata */ }
  }, [table?.id, business?.id, sessionToken]);

  useEffect(() => {
    if (table?.id && business?.id) {
      checkActiveRequests();
      const iv = setInterval(checkActiveRequests, 5000);
      return () => clearInterval(iv);
    }
  }, [table?.id, business?.id, checkActiveRequests]);

  // ✅ IntersectionObserver
  useEffect(() => {
    if (categories.length === 0) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const catId = entry.target.getAttribute("data-category-id");
            if (catId) {
              setActiveCategory(catId);
              const activeTab = document.querySelector(`[data-tab-id="${catId}"]`);
              if (activeTab && categoryTabsRef.current) {
                const container = categoryTabsRef.current;
                const tab = activeTab as HTMLElement;
                const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: "smooth" });
              }
            }
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    categories.forEach((cat) => {
      const el = categoryRefs.current[cat.id];
      if (el) observerRef.current?.observe(el);
    });
    return () => { observerRef.current?.disconnect(); };
  }, [categories]);

  const orderable = (p: Product) => p.isAvailable && p.stockStatus === "IN_STOCK";

  const addToCart = (p: Product, note?: string) => {
    if (!orderable(p)) { showToast("Bu ürün şu anda mevcut değil", "err"); return; }
    setCart(prev => {
      const ex = prev.find(i => i.product.id === p.id && i.customerNote === note);
      if (ex) return prev.map(i => i.product.id === p.id && i.customerNote === note ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1, customerNote: note }];
    });
    showToast(`${p.name} sepete eklendi`);
  };

  const updateQty = (pid: string, note: string | undefined, d: number) => {
    setCart(prev => prev.map(i => i.product.id === pid && i.customerNote === note ? { ...i, quantity: i.quantity + d } : i).filter(i => i.quantity > 0));
  };

  const cartTotal = cart.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ✅ Tek gerçek sipariş gönderme fonksiyonu — yalnız AUTHORIZED durumda çağrılır
  const sendActualOrder = async (token: string): Promise<boolean> => {
    const r = await fetch("/api/customer/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": token },
      body: JSON.stringify({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, customerNote: i.customerNote || null })),
        note: orderNote || null,
        idempotencyKey: `ord_${uuidv4()}`,
      }),
    });
    if (r.ok) {
      setCart([]);
      setOrderNote("");
      setShowCartMobile(false);
      showToast("Siparişiniz gönderildi! Garson onayı bekleniyor... ⏳");
      return true;
    }
    const d = await r.json();
    if (d.code === "CUSTOMER_DEVICE_BLOCKED") {
      showToast("Bu cihazın bu işletmede işlem yapması engellendi.", "err");
    } else if (d.code === "SESSION_NOT_AUTHORIZED_FOR_TABLE" || d.code === "SESSION_REVOKED") {
      setAuthStatus("REVOKED");
      showToast("Oturumunuz sonlanmış. Personelden yardım isteyin.", "err");
    } else {
      showToast(d.error || "Sipariş gönderilemedi", "err");
    }
    return false;
  };

  // ✅ Yetkiye göre ana sipariş aksiyonu
  const submitOrder = async () => {
    if (!cart.length || !business || !table) return;
    if (submitting) return;

    // REVOKED veya TABLE_ALREADY_CLAIMED durumunda engelle
    if (authStatus === "REVOKED" || authStatus === "TABLE_ALREADY_CLAIMED") {
      showToast("Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.", "err");
      return;
    }

    setSubmitting(true);
    try {
      const token = sessionToken || (await ensureCustomerSession(table.id));
      if (!token) {
        showToast(orderBlockedMsg || "Sipariş vermek için masadaki QR kodu okutun.", "err");
        return;
      }

      // ✅ FIX: Canonical status'u önce kontrol et — local state stale olabilir
      // Explicit AuthStatus annotation — TS narrows authStatus after the early return guard,
      // but serverSession.status can be any AuthStatus value including REVOKED.
      let effectiveAuthStatus: AuthStatus = authStatus;
      try {
        const serverSession = await fetchCanonicalSessionStatus(token);
        if (serverSession.ok && serverSession.status) {
          // Route-table eşleşme kontrolü
          if (serverSession.businessId !== resolvedParams.businessId || serverSession.tableId !== table.id) {
            showToast("Oturum farklı masaya ait. Lütfen QR kodu tekrar okutun.", "err");
            return;
          }
          effectiveAuthStatus = serverSession.status;
          if (effectiveAuthStatus !== authStatus) {
            setAuthStatus(effectiveAuthStatus);
          }

          // Canonical durumda REVOKED veya TABLE_ALREADY_CLAIMED ise engelle
          if (effectiveAuthStatus === "REVOKED") {
            showToast("Oturumunuz iptal edilmiş. Personelden yardım isteyin.", "err");
            return;
          }
          if (effectiveAuthStatus === "TABLE_ALREADY_CLAIMED") {
            showToast("Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.", "err");
            return;
          }
        } else if (serverSession.code === "SESSION_REVOKED") {
          setAuthStatus("REVOKED");
          showToast("Oturumunuz iptal edilmiş. Personelden yardım isteyin.", "err");
          return;
        } else if (serverSession.code === "SESSION_EXPIRED" || serverSession.code === "SESSION_NOT_FOUND") {
          showToast("Oturum süresi dolmuş. QR kodu tekrar okutun.", "err");
          return;
        }
      } catch {
        // Network error — local state ile devam et
      }

      // ── AUTHORIZED: Aynı tıklamada gerçek siparişi gönder
      if (effectiveAuthStatus === "AUTHORIZED") {
        await sendActualOrder(token);
        return;
      }

      // ── PENDING: Zaten bekliyor, ikinci ORDER_REQUEST oluşturma
      if (effectiveAuthStatus === "PENDING") {
        showToast("Garson onayı bekleniyor. Lütfen bekleyin.", "err");
        return;
      }

      // ── VIEW_ONLY: ORDER_REQUEST oluştur (sepet verileri ile)
      if (effectiveAuthStatus === "VIEW_ONLY") {
        const r = await fetch("/api/customer/service-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-token": token },
          body: JSON.stringify({
            businessId: business.id,
            tableId: table.id,
            requestType: "ORDER_REQUEST",
            reason: "Sipariş vermek istiyorum",
            items: cart.map(i => ({
              productId: i.product.id,
              quantity: i.quantity,
              customerNote: i.customerNote || null,
            })),
            orderNote: orderNote || null,
            idempotencyKey: `or_${uuidv4()}`,
          }),
        });
        const d = await r.json();
        if (r.ok || r.status === 200) {
          setAuthStatus("PENDING");
          if (d.serviceRequest?.verificationCode) {
            setVerificationCode(d.serviceRequest.verificationCode);
          }
          if (d.serviceRequest?.expiresAt) {
            setPendingRequestExpiresAt(d.serviceRequest.expiresAt);
          }
          // ✅ Sepet korunur — ORDER_REQUEST ile temizleme
          showToast("Sipariş talebiniz oluşturuldu. Garson onayı bekleniyor.", "ok");
        } else if (d.code === "CUSTOMER_DEVICE_BLOCKED") {
          showToast("Bu cihazın bu işletmede işlem yapması engellendi.", "err");
        } else if (d.code === "TABLE_ALREADY_CLAIMED") {
          setAuthStatus("TABLE_ALREADY_CLAIMED");
          showToast("Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.", "err");
        } else if (d.code === "ORDER_REQUEST_PENDING") {
          setAuthStatus("PENDING");
          if (d.serviceRequest?.verificationCode) setVerificationCode(d.serviceRequest.verificationCode);
          showToast("Bekleyen talebiniz var. Garson onayı bekleniyor.", "err");
        } else if (d.code === "SESSION_ALREADY_AUTHORIZED") {
          // ✅ FIX: Canonical doğrula + aynı tıklamada sipariş gönder
          try {
            const recheck = await fetchCanonicalSessionStatus(token);
            if (recheck.ok && recheck.status === "AUTHORIZED") {
              setAuthStatus("AUTHORIZED");
              await sendActualOrder(token);
            } else {
              setAuthStatus("AUTHORIZED");
              showToast("Masanız açık! Siparişi Gönder butonuna basın.", "ok");
            }
          } catch {
            setAuthStatus("AUTHORIZED");
            showToast("Masanız açık! Siparişi Gönder butonuna basın.", "ok");
          }
        } else {
          showToast(d.error || "Talep gönderilemedi", "err");
        }
        return;
      }

    } catch { showToast("Bağlantı hatası", "err"); }
    finally { setSubmitting(false); }
  };

  const [sendingRequest, setSendingRequest] = useState(false);

  const sendRequest = async (type: string, reason?: string, note?: string) => {
    if (!business || !table) return;
    if (sendingRequest) return;

    // Hizmet talepleri için AUTHORIZED gerekli (ORDER_REQUEST hariç)
    if (type !== "ORDER_REQUEST" && authStatus !== "AUTHORIZED") {
      showToast("Masanız henüz açılmamış. Önce sipariş talebi oluşturun.", "err");
      return;
    }

    const token = sessionToken || (await ensureCustomerSession(table.id));
    if (!token) {
      showToast(orderBlockedMsg || "Talep göndermek için masadaki QR kodu okutun.", "err");
      return;
    }

    const isBlocked =
      (type === "CALL_WAITER" && (activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"])) ||
      (type === "PAYMENT_REQUEST" && (activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"])) ||
      (type === "ORDER_REQUEST" && activeRequests["ORDER_REQUEST"]);

    if (isBlocked) {
      if (type === "PAYMENT_REQUEST") {
        showToast("Ödeme talebiniz zaten bekliyor.", "err");
      } else {
        showToast("Devam eden bir talebiniz var. Lütfen bekleyin.", "err");
      }
      return;
    }

    setSendingRequest(true);
    try {
      // ✅ PAYMENT_REQUEST → özel ödeme endpointi
      const isPaymentRequest = type === "PAYMENT_REQUEST";
      const endpoint = isPaymentRequest
        ? "/api/customer/payment-requests"
        : "/api/customer/service-requests";

      const payload = isPaymentRequest
        ? {
            businessId: business.id,
            tableId: table.id,
            note: note || null,
          }
        : {
            businessId: business.id,
            tableId: table.id,
            requestType: type,
            reason: reason || null,
            note: note || null,
          };

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const msgs: Record<string, string> = {
          CALL_WAITER: "Garson çağrıldı! 🙋",
          PAYMENT_REQUEST: "Ödeme talebi gönderildi! 💳",
          HELP_REQUEST: "Yardım talebi gönderildi! ℹ️",
          ORDER_REQUEST: "Sipariş talebi garsona iletildi. 📋",
        };
        showToast(msgs[type] || "Talep gönderildi");
        setShowServiceMenu(false); setShowWaiterModal(false); setWaiterReason(""); setWaiterNote("");
        checkActiveRequests();
      } else {
        const d = await r.json();
        if (d.code === "CUSTOMER_DEVICE_BLOCKED") {
          showToast("Bu cihazın bu işletmede işlem yapması engellendi.", "err");
        } else if (isPaymentRequest && (r.status === 409 || d.code === "PAYMENT_REQUEST_ALREADY_EXISTS")) {
          showToast("Ödeme talebiniz zaten bekliyor.", "err");
        } else {
          showToast(d.error || "Talep gönderilemedi", "err");
        }
      }
    } catch { showToast("Bağlantı hatası", "err"); }
    finally { setSendingRequest(false); }
  };

  const scrollTo = (catId: string) => {
    const el = categoryRefs.current[catId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const stockLabel = (p: Product) => {
    if (!p.isAvailable || p.stockStatus === "OUT_OF_STOCK") return { text: "Stokta Yok", color: "#ef4444" };
    if (p.stockStatus === "TEMPORARILY_UNAVAILABLE") return { text: "Geçici Yok", color: "#f59e0b" };
    return null;
  };

  // ✅ Sipariş butonunun duruma göre metni ve etkinliği
  const getOrderButtonProps = () => {
    // Canonical durum henüz bilinmiyor → buton disabled
    if (!sessionStateHydrated) {
      return { label: "⏳ Oturum kontrol ediliyor...", isDisabled: true };
    }

    const isDisabled = authStatus === "REVOKED" || authStatus === "TABLE_ALREADY_CLAIMED" || authStatus === "PENDING";
    let label = "Sipariş Ver";

    switch (authStatus) {
      case "VIEW_ONLY":
        label = "Sipariş Talebi Oluştur";
        break;
      case "PENDING":
        label = "⏳ Garson Onayı Bekleniyor...";
        break;
      case "AUTHORIZED":
        label = "Siparişi Gönder 🚀";
        break;
      case "REVOKED":
      case "TABLE_ALREADY_CLAIMED":
        label = "🔒 Masa Başka Oturuma Ait";
        break;
    }

    return { label, isDisabled: isDisabled || submitting };
  };

  // Sepet içeriği
  const renderCartContent = () => {
    const btnProps = getOrderButtonProps();

    return (
      <>
        {/* PENDING durumunda doğrulama kodu göster */}
        {authStatus === "PENDING" && verificationCode && (
          <div style={{
            padding: "16px", marginBottom: 16,
            background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))",
            borderRadius: 14, border: "1px solid rgba(245,158,11,0.25)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Masa Doğrulama Kodunuz
            </p>
            <p style={{ fontSize: 36, fontWeight: 900, color: "#d97706", letterSpacing: "0.2em", fontFamily: "monospace" }}>
              {verificationCode}
            </p>
            <p style={{ fontSize: 12, color: "#78716c", marginTop: 6 }}>
              Garson masanıza geldiğinde bu kodu söyleyin.
            </p>
          </div>
        )}

        {/* REVOKED/TABLE_ALREADY_CLAIMED mesajı */}
        {(authStatus === "REVOKED" || authStatus === "TABLE_ALREADY_CLAIMED") && (
          <div style={{
            padding: "14px 16px", marginBottom: 16,
            background: "rgba(239,68,68,0.08)", borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.25)",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>
              🔒 Bu masa başka bir aktif oturuma ait.
            </p>
            <p style={{ fontSize: 12, color: "#78716c", marginTop: 4 }}>
              Personelden yardım isteyin.
            </p>
          </div>
        )}

        {cart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
            <p style={{ fontSize: 14 }}>Sepetiniz boş</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
              {cart.map(item => (
                <div key={`${item.product.id}-${item.customerNote}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{item.product.name}</p>
                    {item.customerNote && <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>📝 {item.customerNote}</p>}
                    <p style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700, marginTop: 2 }}>{(Number(item.product.price) * item.quantity).toFixed(2)} ₺</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => updateQty(item.product.id, item.customerNote, -1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 15, width: 24, textAlign: "center", color: "var(--text-primary)" }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, item.customerNote, 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              ))}
            </div>
            {authStatus === "AUTHORIZED" && (
              <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Sipariş notu (opsiyonel)..." className="input" style={{ resize: "none", height: 56, marginBottom: 16 }} />
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 0", borderTop: "2px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Toplam</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>{cartTotal.toFixed(2)} ₺</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={btnProps.isDisabled}
              className="btn btn-primary"
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 16,
                opacity: btnProps.isDisabled ? 0.6 : 1,
              }}
            >
              {submitting ? "Gönderiliyor..." : btnProps.label}
            </button>
          </>
        )}
      </>
    );
  };

  // ── Loading ──
  if (loading) return (
    <div className="customer-theme" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, border: "3px solid var(--border-color)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500 }}>Menü yükleniyor...</p>
    </div>
  );

  // ── Error ──
  if (sessionError || !business) return (
    <div className="customer-theme" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 340, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Erişim Hatası</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{sessionError || "Bu sayfa bulunamadı."}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: "12px 28px", borderRadius: 12 }}>
          Tekrar Dene
        </button>
      </div>
    </div>
  );

  return (
    <div className="customer-theme" style={{ minHeight: "100vh", paddingBottom: 0 }}>
      <style>{`
        .prod-card:active { transform: scale(0.98); }
        .service-btn:hover { background: var(--bg-hover) !important; }
        .cat-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {orderBlockedMsg && !sessionToken && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 16px 0" }}>
          <div style={{
            padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: "rgba(217,119,6,0.12)", color: "#92400e", border: "1px solid rgba(217,119,6,0.35)",
          }}>
            ⚠️ {orderBlockedMsg}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          background: toast.type === "err" ? "var(--danger)" : "var(--success)",
          color: "white", boxShadow: "var(--shadow-md)",
          animation: "slideInRight 0.25s ease", whiteSpace: "nowrap",
          maxWidth: "90vw", textAlign: "center",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
        padding: "16px 16px 24px",
        color: "white",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              {business.logo ? (
                <img src={business.logo} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }} />
              ) : "🏪"}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {business.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{
                  fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 99, fontWeight: 600, backdropFilter: "blur(4px)",
                }}>
                  🪑 {table?.tableName || `Masa ${table?.tableNumber}`}
                </span>
                {/* Yetki durumu badge */}
                {authStatus === "AUTHORIZED" && (
                  <span style={{ fontSize: 10, background: "rgba(34,197,94,0.3)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>✓ Aktif</span>
                )}
                {authStatus === "PENDING" && (
                  <span style={{ fontSize: 10, background: "rgba(245,158,11,0.3)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>⏳ Onay</span>
                )}
              </div>
            </div>
          </div>
          {/* Desktop Service Menu Button — yalnız AUTHORIZED ise göster */}
          {authStatus === "AUTHORIZED" && (
            <div className="hidden lg:block">
              <button
                onClick={() => setShowServiceMenu(true)}
                className="btn btn-ghost"
                style={{
                  background: "rgba(255,255,255,0.15)", color: "white",
                  borderColor: "rgba(255,255,255,0.25)", borderRadius: 99,
                  backdropFilter: "blur(8px)", fontSize: 13, padding: "8px 16px",
                }}
              >
                🔔 Hizmet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }}>
        <div className="flex flex-col lg:flex-row gap-6" style={{ paddingTop: 16 }}>

          {/* Kolon 1: Kategoriler */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="hidden lg:block">
              <div ref={categoryTabsRef} className="bg-white rounded-xl shadow-sm border p-2 sticky flex-col gap-2" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", top: 96 }}>
                {categories.map(cat => (
                  <button key={cat.id} data-tab-id={cat.id} onClick={() => scrollTo(cat.id)} style={{
                    padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer", transition: "all 0.2s", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    background: activeCategory === cat.id ? "var(--primary)" : "transparent",
                    color: activeCategory === cat.id ? "white" : "var(--text-secondary)",
                    transform: activeCategory === cat.id ? "translateX(4px)" : "translateX(0)",
                    boxShadow: activeCategory === cat.id ? "0 4px 12px rgba(185,28,28,0.3)" : "none",
                  }}>
                    {cat.icon && <span style={{ fontSize: 18 }}>{cat.icon}</span>}
                    <span style={{ flex: 1 }}>{cat.name}</span>
                    {activeCategory === cat.id && <span style={{ fontSize: 12 }}>→</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:hidden sticky bg-[var(--bg-primary)]" style={{ top: 80, zIndex: 30, marginLeft: -16, marginRight: -16, padding: "12px 0" }}>
              <div ref={categoryTabsRef} className="flex gap-2 overflow-x-auto cat-scroll px-4" style={{ scrollPaddingLeft: 16 }}>
                {categories.map(cat => (
                  <button key={cat.id} data-tab-id={cat.id} onClick={() => scrollTo(cat.id)} style={{
                    padding: "10px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                    border: activeCategory === cat.id ? "2px solid var(--primary)" : "2px solid var(--border-color)",
                    cursor: "pointer", transition: "all 0.2s",
                    background: activeCategory === cat.id ? "var(--primary)" : "var(--bg-card)",
                    color: activeCategory === cat.id ? "white" : "var(--text-secondary)",
                    boxShadow: activeCategory === cat.id ? "0 4px 12px rgba(185,28,28,0.25)" : "0 1px 3px rgba(0,0,0,0.05)",
                    transform: activeCategory === cat.id ? "scale(1.05)" : "scale(1)",
                  }}>
                    {cat.icon && <span style={{ marginRight: 6 }}>{cat.icon}</span>}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kolon 2: Ürünler */}
          <div className="flex-1 pb-24 lg:pb-8 pt-0">
            {categories.map(cat => (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }} data-category-id={cat.id} style={{ marginBottom: 40, scrollMarginTop: 160 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 18, display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "2px solid var(--border-subtle)" }}>
                  {cat.icon && <span style={{ fontSize: 24 }}>{cat.icon}</span>}
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{cat.products.length} ürün</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.products.map(p => {
                    const sl = stockLabel(p);
                    const ok = orderable(p);
                    return (
                      <div key={p.id} className="prod-card card" onClick={() => ok && setSelectedProduct(p)} style={{
                        padding: 0, display: "flex", flexDirection: "column", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.65, overflow: "hidden", position: "relative", transition: "transform 0.2s, box-shadow 0.2s",
                      }}>
                        {p.image && (
                          <div style={{ width: "100%", height: 140, background: `url(${p.image}) center/cover`, position: "relative" }}>
                            <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {p.isPopular && <span className="badge badge-accent" style={{ backdropFilter: "blur(4px)" }}>⭐ Popüler</span>}
                              {sl && <span className="badge" style={{ background: `${sl.color}`, color: "white", backdropFilter: "blur(4px)" }}>{sl.text}</span>}
                            </div>
                          </div>
                        )}
                        <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>{p.name}</span>
                            {!p.image && (<>
                              {p.isPopular && <span className="badge badge-accent">⭐</span>}
                              {sl && <span className="badge" style={{ background: `${sl.color}15`, color: sl.color }}>{sl.text}</span>}
                            </>)}
                          </div>
                          {p.description && (
                            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
                            <span style={{ fontSize: 19, fontWeight: 800, color: "var(--primary)" }}>{Number(p.price).toFixed(2)} ₺</span>
                            <button onClick={e => { e.stopPropagation(); addToCart(p); }} disabled={!ok} className="btn btn-sm" style={{
                              background: ok ? `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` : "var(--bg-hover)",
                              color: ok ? "white" : "var(--text-muted)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700,
                              boxShadow: ok ? "0 2px 8px rgba(185,28,28,0.25)" : "none",
                            }}>
                              {ok ? "+ Ekle" : "Yok"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Kolon 3: Sepet (Desktop) */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-md border p-5 sticky" style={{
              background: "var(--bg-card)", borderColor: "var(--border-color)", top: 96,
              maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                🛒 Sepetim
                {cartCount > 0 && (
                  <span style={{ background: "var(--primary)", color: "white", borderRadius: 99, fontSize: 12, fontWeight: 700, padding: "2px 8px", minWidth: 24, textAlign: "center" }}>{cartCount}</span>
                )}
              </h2>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
                {renderCartContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Detail Modal ── */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)} style={{ alignItems: "flex-end" }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{selectedProduct.name}</h2>
              <button onClick={() => setSelectedProduct(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {selectedProduct.description && <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{selectedProduct.description}</p>}
              {selectedProduct.ingredients && (
                <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>İçindekiler</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{selectedProduct.ingredients}</p>
                </div>
              )}
              {selectedProduct.allergens && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(217,119,6,0.05)", borderRadius: 10, border: "1px solid rgba(217,119,6,0.2)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠️ Alerjenler</p>
                  <p style={{ fontSize: 13, color: "var(--accent)" }}>{selectedProduct.allergens}</p>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>📝 Özel Not (opsiyonel)</label>
                <textarea id="prod-note" placeholder="Örn: Soğansız, az pişmiş..." className="input" style={{ resize: "none", height: 60 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>{Number(selectedProduct.price).toFixed(2)} ₺</span>
                <button onClick={() => {
                  const note = (document.getElementById("prod-note") as HTMLTextAreaElement)?.value;
                  addToCart(selectedProduct, note || undefined);
                  setSelectedProduct(null);
                }} className="btn btn-primary btn-lg">
                  Sepete Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Cart Modal ── */}
      {showCartMobile && (
        <div className="modal-overlay lg:hidden" onClick={() => setShowCartMobile(false)} style={{ alignItems: "flex-end" }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderRadius: "20px 20px 0 0", margin: 0, maxWidth: 600, padding: 0 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1, borderRadius: "20px 20px 0 0" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>🛒 Sepetim</h2>
              <button onClick={() => setShowCartMobile(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "12px 20px 20px", maxHeight: "70vh", overflowY: "auto" }}>
              {renderCartContent()}
            </div>
          </div>
        </div>
      )}

      {/* ── Garson Çağırma Modalı ── */}
      {showWaiterModal && (
        <div className="modal-overlay" onClick={() => setShowWaiterModal(false)} style={{ alignItems: "flex-end" }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>🙋 Garson Çağır</h2>
              <button onClick={() => setShowWaiterModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14 }}>Garsonun size daha hızlı yardımcı olabilmesi için nedeninizi seçin:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {WAITER_REASONS.map(r => (
                  <button key={r} onClick={() => setWaiterReason(r)} style={{
                    padding: "12px 16px", borderRadius: 12, textAlign: "left", fontSize: 14, fontWeight: 600,
                    border: `2px solid ${waiterReason === r ? "var(--primary)" : "var(--border-color)"}`,
                    background: waiterReason === r ? "var(--primary-glow)" : "var(--bg-card)",
                    color: waiterReason === r ? "var(--primary-dark)" : "var(--text-primary)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {waiterReason === r ? "✓ " : ""}{r}
                  </button>
                ))}
              </div>
              {waiterReason === "Diğer" && (
                <textarea value={waiterNote} onChange={e => setWaiterNote(e.target.value)} placeholder="Açıklama yazın..." maxLength={200} className="input" style={{ resize: "none", height: 60, marginBottom: 14 }} />
              )}
              <button
                onClick={() => sendRequest("CALL_WAITER", waiterReason === "Diğer" ? waiterNote : waiterReason)}
                disabled={!waiterReason || (waiterReason === "Diğer" && !waiterNote.trim()) || sendingRequest}
                className="btn btn-primary" style={{ width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 16 }}>
                {sendingRequest ? "Gönderiliyor..." : "Garson Çağır"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hizmet Menüsü Modalı ── */}
      {showServiceMenu && (
        <div className="modal-overlay" onClick={() => setShowServiceMenu(false)} style={{ alignItems: "flex-end" }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Hizmet Talepleri</h2>
              <button onClick={() => setShowServiceMenu(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  type: "CALL_WAITER", icon: "🙋", title: "Garson Çağır", desc: "Garsonun masanıza gelmesini sağlayın",
                  action: () => { setShowServiceMenu(false); setShowWaiterModal(true); },
                  blocked: activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"],
                  activeMsg: activeRequests["CALL_WAITER"] ? "Çağrınız iletildi, bekleniyor..." : undefined,
                },
                {
                  type: "PAYMENT_REQUEST", icon: "💳", title: "Ödeme İste", desc: "Hesabınızı kapatmak için garson çağırın",
                  action: () => sendRequest("PAYMENT_REQUEST"),
                  blocked: activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"] || sendingRequest,
                  activeMsg: activeRequests["PAYMENT_REQUEST"] ? "Ödeme talebiniz iletildi, bekleniyor..." : undefined,
                },
                {
                  type: "HELP_REQUEST", icon: "ℹ️", title: "Yardım İste", desc: "Bilgi veya destek talebi oluşturun",
                  action: () => sendRequest("HELP_REQUEST"),
                  blocked: false, activeMsg: undefined,
                },
              ].map(item => (
                <div key={item.type}>
                  <button className="service-btn card" onClick={(item.blocked || sendingRequest) ? undefined : item.action} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 16,
                    border: `1px solid ${item.blocked ? "rgba(220,38,38,0.3)" : "var(--border-color)"}`,
                    background: item.blocked ? "rgba(220,38,38,0.04)" : "var(--bg-card)",
                    cursor: item.blocked ? "not-allowed" : "pointer", textAlign: "left",
                    transition: "all 0.15s", width: "100%", opacity: item.blocked ? 0.8 : 1, boxShadow: "var(--shadow-sm)"
                  }}>
                    <span style={{ fontSize: 32, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, color: item.blocked ? "var(--text-muted)" : "var(--text-primary)" }}>{item.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.activeMsg || item.desc}</p>
                    </div>
                    {item.blocked ? (
                      <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>⏳ Bekliyor</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 20 }}>›</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Bar ── */}
      <div className="lg:hidden" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-card)", borderTop: "1px solid var(--border-color)",
        padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        display: "flex", gap: 10, zIndex: 40, boxShadow: "0 -4px 16px rgba(0,0,0,0.05)"
      }}>
        {authStatus === "AUTHORIZED" && (
          <button onClick={() => setShowServiceMenu(true)} style={{
            flex: 1, padding: "12px 8px", borderRadius: 12,
            border: "1px solid var(--border-color)", background: "var(--bg-hover)",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3
          }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <span style={{ fontSize: 11 }}>Hizmet</span>
          </button>
        )}
        <button onClick={() => setShowCartMobile(true)} disabled={cartCount === 0} style={{
          flex: authStatus === "AUTHORIZED" ? 3 : 4,
          padding: "12px 16px", borderRadius: 12, border: "none",
          background: cartCount > 0 ? `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` : "var(--bg-hover)",
          color: cartCount > 0 ? "white" : "var(--text-muted)",
          cursor: cartCount > 0 ? "pointer" : "not-allowed",
          fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: cartCount > 0 ? `0 4px 16px rgba(185,28,28,0.4)` : "none",
          transition: "all 0.2s",
        }}>
          {cartCount > 0 ? (
            <>
              <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "2px 10px", fontSize: 14, fontWeight: 800 }}>{cartCount}</span>
              Sepet · {cartTotal.toFixed(2)} ₺
            </>
          ) : "🛒 Sepet Boş"}
        </button>
      </div>
    </div>
  );
}
