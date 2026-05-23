"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

const BRAND = "#B91C1C"; // Bordo
const BRAND_DARK = "#991B1B";
const ACCENT = "#D97706"; // Altın sarısı

export default function CustomerMenuPage({ params }: { params: { businessId: string; tableNumber: string } }) {
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
  const [activeRequests, setActiveRequests] = useState<Record<string, boolean>>({});
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt" | "checking">("checking");
  const [isWithinRange, setIsWithinRange] = useState<boolean>(true);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; allowed: number } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMenu = useCallback(async (initial = false) => {
    try {
      const res = await fetch(`/api/menu/${params.businessId}/${params.tableNumber}`);
      const data = await res.json();
      if (res.ok) {
        setBusiness(data.business);
        setTable(data.table);
        setCategories(data.categories || []);
        if (initial && data.categories?.length > 0) setActiveCategory(data.categories[0].id);
        if (initial) {
          try {
            const sr = await fetch("/api/customer/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId: params.businessId, tableId: data.table.id }),
            });
            const sd = await sr.json();
            if (sr.ok) setSessionToken(sd.sessionToken);
            else setSessionError(sd.error || "Oturum başlatılamadı.");
          } catch { setSessionError("Bağlantı hatası."); }
        }
      } else {
        if (initial) setSessionError(data.error || "Menü yüklenemedi.");
      }
    } catch { if (initial) setSessionError("Bağlantı hatası."); }
    finally { if (initial) setLoading(false); }
  }, [params.businessId, params.tableNumber]);

  useEffect(() => { fetchMenu(true); }, [fetchMenu]);
  useEffect(() => { const iv = setInterval(() => fetchMenu(false), 5000); return () => clearInterval(iv); }, [fetchMenu]);

  const checkActiveRequests = useCallback(async () => {
    if (!table?.id || !business?.id) return;
    try {
      const res = await fetch(`/api/customer/active-requests?tableId=${table.id}&businessId=${business.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRequests(data.activeRequests || {});
      }
    } catch { /* sessiz hata */ }
  }, [table?.id, business?.id]);

  useEffect(() => {
    if (table?.id && business?.id) {
      checkActiveRequests();
      const iv = setInterval(checkActiveRequests, 5000);
      return () => clearInterval(iv);
    }
  }, [table?.id, business?.id, checkActiveRequests]);

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

  const getLocation = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 5000 });
    });

  const checkLocationPermissionAndRange = useCallback(async () => {
    if (!business || !navigator.geolocation) {
      setLocationPermission("denied");
      return;
    }

    // Konum izni kontrolü
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        setLocationPermission(result.state as any);
        
        result.addEventListener("change", () => {
          setLocationPermission(result.state as any);
        });
      } catch {
        setLocationPermission("prompt");
      }
    }

    // İşletme konum kısıtlaması var mı kontrol et
    const bizData = business as any;
    if (!bizData.latitude || !bizData.longitude || !bizData.allowedRadiusMeters) {
      // Konum kısıtlaması yok, her zaman izin ver
      setIsWithinRange(true);
      return;
    }

    // Kullanıcı konumunu al ve mesafeyi hesapla
    const loc = await getLocation();
    if (!loc) {
      setIsWithinRange(false);
      return;
    }

    // Haversine formülü ile mesafe hesapla
    const R = 6371e3;
    const dLat = (loc.lat - bizData.latitude) * (Math.PI / 180);
    const dLon = (loc.lng - bizData.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(bizData.latitude * (Math.PI / 180)) * Math.cos(loc.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    setDistanceInfo({ distance: Math.round(distance), allowed: bizData.allowedRadiusMeters });
    setIsWithinRange(distance <= bizData.allowedRadiusMeters);
  }, [business]);

  useEffect(() => {
    if (business) {
      checkLocationPermissionAndRange();
      // Her 10 saniyede bir konum kontrolü yap
      const interval = setInterval(checkLocationPermissionAndRange, 10000);
      return () => clearInterval(interval);
    }
  }, [business, checkLocationPermissionAndRange]);

  const submitOrder = async () => {
    if (!cart.length || !business || !table) return;
    
    // Konum kontrolü
    if (locationPermission === "denied" || !isWithinRange) {
      if (locationPermission === "denied") {
        showToast("Sipariş vermek için konum izni gereklidir", "err");
      } else {
        showToast("Sipariş vermek için restoran içinde olmalısınız", "err");
      }
      return;
    }
    
    setSubmitting(true);
    try {
      const loc = await getLocation();
      const r = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sessionToken && { "x-session-token": sessionToken }) },
        body: JSON.stringify({ businessId: business.id, tableId: table.id, items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, customerNote: i.customerNote || null })), note: orderNote || null, customerLat: loc?.lat, customerLng: loc?.lng }),
      });
      if (r.ok) { setCart([]); setOrderNote(""); setShowCartMobile(false); showToast("Siparişiniz alındı! 🎉"); }
      else { const d = await r.json(); showToast(d.error || "Sipariş gönderilemedi", "err"); }
    } catch { showToast("Bağlantı hatası", "err"); }
    finally { setSubmitting(false); }
  };

  const sendRequest = async (type: string, reason?: string, note?: string) => {
    if (!business || !table) return;
    
    // Konum kontrolü
    if (locationPermission === "denied" || !isWithinRange) {
      if (locationPermission === "denied") {
        showToast("Bu işlem için konum izni gereklidir", "err");
      } else {
        showToast("Bu işlem için restoran içinde olmalısınız", "err");
      }
      return;
    }
    
    const isBlocked =
      (type === "CALL_WAITER" && (activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"])) ||
      (type === "PAYMENT_REQUEST" && (activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"]));

    if (isBlocked) {
      showToast("Devam eden bir talebiniz var. Lütfen bekleyin.", "err");
      return;
    }

    try {
      const loc = await getLocation();
      const ep = type === "PAYMENT_REQUEST" ? "/api/customer/payment-requests" : "/api/customer/service-requests";
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sessionToken && { "x-session-token": sessionToken }) },
        body: JSON.stringify({ businessId: business.id, tableId: table.id, requestType: type, reason: reason || null, note: note || null, customerLat: loc?.lat, customerLng: loc?.lng }),
      });
      if (r.ok) {
        const msgs: Record<string, string> = { CALL_WAITER: "Garson çağrıldı! 🙋", PAYMENT_REQUEST: "Ödeme talebi gönderildi! 💳", HELP_REQUEST: "Yardım talebi gönderildi! ℹ️" };
        showToast(msgs[type] || "Talep gönderildi");
        setShowServiceMenu(false); setShowWaiterModal(false); setWaiterReason(""); setWaiterNote("");
        checkActiveRequests();
      } else { const d = await r.json(); showToast(d.error || "Talep gönderilemedi", "err"); }
    } catch { showToast("Bağlantı hatası", "err"); }
  };

  const scrollTo = (catId: string) => {
    setActiveCategory(catId);
    // IntersectionObserver'ın aktifliği bozmasını engellemek için offset
    const el = categoryRefs.current[catId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const stockLabel = (p: Product) => {
    if (!p.isAvailable || p.stockStatus === "OUT_OF_STOCK") return { text: "Stokta Yok", color: "#ef4444" };
    if (p.stockStatus === "TEMPORARILY_UNAVAILABLE") return { text: "Geçici Yok", color: "#f59e0b" };
    return null;
  };

  // Sepet içeriği (Desktop & Mobil ortak)
  const renderCartContent = () => (
    <>
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
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Sipariş notu (opsiyonel)..." className="input" style={{ resize: "none", height: 56, marginBottom: 16 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 0", borderTop: "2px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Toplam</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>{cartTotal.toFixed(2)} ₺</span>
          </div>
          <button 
            onClick={submitOrder} 
            disabled={submitting || locationPermission === "denied" || !isWithinRange} 
            className="btn btn-primary" 
            style={{ 
              width: "100%", 
              padding: "15px 0", 
              borderRadius: 14, 
              fontSize: 16,
              opacity: (locationPermission === "denied" || !isWithinRange) ? 0.5 : 1,
              cursor: (locationPermission === "denied" || !isWithinRange) ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Gönderiliyor..." : 
             locationPermission === "denied" ? "🔒 Konum İzni Gerekli" :
             !isWithinRange ? "🔒 Restoran Dışındasınız" :
             "Siparişi Gönder 🚀"}
          </button>
          {(locationPermission === "denied" || !isWithinRange) && (
            <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: 8 }}>
              {locationPermission === "denied" 
                ? "Sipariş vermek için tarayıcınızdan konum izni vermeniz gerekiyor."
                : distanceInfo 
                  ? `Restoran ${distanceInfo.allowed}m içinde olmalısınız. Şu anki mesafeniz: ${distanceInfo.distance}m`
                  : "Sipariş vermek için restoran içinde olmalısınız."}
            </p>
          )}
        </>
      )}
    </>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="customer-theme" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, border: "3px solid var(--border-color)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500 }}>Menü yükleniyor...</p>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
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
    <div className="customer-theme" style={{ minHeight: "100vh", paddingBottom: 88 }}>
      <style>{`
        .prod-card:active { transform: scale(0.98); }
        .service-btn:hover { background: var(--bg-hover) !important; }
        .cat-scroll::-webkit-scrollbar { display: none; }
      `}</style>

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

      {/* ── Konum Durumu Banner ────────────────────────────────────────────── */}
      {(locationPermission === "denied" || !isWithinRange) && (
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: locationPermission === "denied" ? "#dc2626" : "#f59e0b",
          color: "white",
          padding: "12px 16px",
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          {locationPermission === "denied" ? (
            <>
              🔒 Sipariş ve hizmet talepleri için konum izni gereklidir
              <button
                onClick={() => {
                  navigator.geolocation.getCurrentPosition(
                    () => checkLocationPermissionAndRange(),
                    () => showToast("Konum izni reddedildi", "err")
                  );
                }}
                style={{
                  marginLeft: 8,
                  padding: "4px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                İzin Ver
              </button>
            </>
          ) : (
            <>
              ⚠️ Restoran dışındasınız - Menüyü görüntüleyebilirsiniz ancak sipariş veremezsiniz
              {distanceInfo && (
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                  Mesafeniz: {distanceInfo.distance}m / İzin verilen: {distanceInfo.allowed}m
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(160deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`, padding: "20px 16px 36px", color: "white" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, backdropFilter: "blur(8px)" }}>
              {business.logo ? <img src={business.logo} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} /> : "🏪"}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{business.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 13, background: "rgba(255,255,255,0.2)", padding: "3px 12px", borderRadius: 99, fontWeight: 600 }}>
                  🪑 {table?.tableName || `Masa ${table?.tableNumber}`}
                </span>
              </div>
            </div>
          </div>
          {/* Desktop Service Menu Button */}
          <div className="hidden lg:block">
             <button onClick={() => setShowServiceMenu(true)} className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.1)", color: "white", borderColor: "rgba(255,255,255,0.2)", borderRadius: 99 }}>
               🔔 Garson / Hizmet
             </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout (3-Column on Desktop) ────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }} className="-mt-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Kolon 1: Kategori Menüsü (Desktop: Sol dikey, Mobil: Yatay kaydırma) */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-[var(--border-color)] p-2 lg:sticky lg:top-6 flex lg:flex-col gap-2 overflow-x-auto cat-scroll" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => scrollTo(cat.id)} style={{
                  padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  whiteSpace: "nowrap", border: "none", cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                  background: activeCategory === cat.id ? "var(--primary)" : "transparent",
                  color: activeCategory === cat.id ? "white" : "var(--text-secondary)",
                }}>
                  {cat.icon && <span style={{ marginRight: 8 }}>{cat.icon}</span>}{cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Kolon 2: Ürünler */}
          <div className="flex-1 pb-20 lg:pb-8 pt-4 lg:pt-0">
            {categories.map(cat => (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  {cat.icon && <span>{cat.icon}</span>}{cat.name}
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>({cat.products.length})</span>
                </h2>
                {/* Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.products.map(p => {
                    const sl = stockLabel(p);
                    const ok = orderable(p);
                    return (
                      <div key={p.id} className="prod-card card" onClick={() => ok && setSelectedProduct(p)} style={{
                        padding: 16, display: "flex", gap: 12, cursor: ok ? "pointer" : "default",
                        opacity: ok ? 1 : 0.65, 
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", lineHeight: 1.3 }}>{p.name}</span>
                            {p.isPopular && <span className="badge badge-accent">⭐ Popüler</span>}
                            {sl && <span className="badge" style={{ background: `${sl.color}15`, color: sl.color }}>{sl.text}</span>}
                          </div>
                          {p.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>{p.description}</p>}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--primary)" }}>{Number(p.price).toFixed(2)} ₺</span>
                            <button onClick={e => { e.stopPropagation(); addToCart(p); }} disabled={!ok} className="btn btn-sm" style={{
                              background: ok ? `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` : "var(--bg-hover)",
                              color: ok ? "white" : "var(--text-muted)",
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

          {/* Kolon 3: Sepet (Sadece Desktop) */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--border-color)] p-5 sticky top-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>🛒 Sepetim</h2>
              {renderCartContent()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Detail Modal ───────────────────────────────────────────── */}
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

      {/* ── Mobile Cart Modal ─────────────────────────────────────────────── */}
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

      {/* ── Garson Çağırma Neden Modalı ───────────────────────────────────── */}
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
                disabled={!waiterReason || (waiterReason === "Diğer" && !waiterNote.trim()) || locationPermission === "denied" || !isWithinRange}
                className="btn btn-primary" 
                style={{ 
                  width: "100%", 
                  padding: "14px 0", 
                  borderRadius: 14, 
                  fontSize: 16,
                  opacity: (locationPermission === "denied" || !isWithinRange) ? 0.5 : 1,
                  cursor: (locationPermission === "denied" || !isWithinRange) ? "not-allowed" : "pointer"
                }}
              >
                {locationPermission === "denied" ? "🔒 Konum İzni Gerekli" :
                 !isWithinRange ? "🔒 Restoran Dışındasınız" :
                 "Garson Çağır"}
              </button>
              {(locationPermission === "denied" || !isWithinRange) && (
                <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: 8 }}>
                  {locationPermission === "denied" 
                    ? "Garson çağırmak için tarayıcınızdan konum izni vermeniz gerekiyor."
                    : distanceInfo 
                      ? `Restoran ${distanceInfo.allowed}m içinde olmalısınız. Şu anki mesafeniz: ${distanceInfo.distance}m`
                      : "Garson çağırmak için restoran içinde olmalısınız."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Hizmet Menüsü Modalı ───────────────────────────────────────────── */}
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
                  type: "CALL_WAITER",
                  icon: "🙋", title: "Garson Çağır", desc: "Garsonun masanıza gelmesini sağlayın",
                  action: () => { setShowServiceMenu(false); setShowWaiterModal(true); },
                  blocked: activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"],
                  activeMsg: activeRequests["CALL_WAITER"] ? "Çağrınız iletildi, bekleniyor..." : undefined,
                  requiresLocation: true,
                },
                {
                  type: "PAYMENT_REQUEST",
                  icon: "💳", title: "Ödeme İste", desc: "Hesabınızı kapatmak için garson çağırın",
                  action: () => sendRequest("PAYMENT_REQUEST"),
                  blocked: activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"],
                  activeMsg: activeRequests["PAYMENT_REQUEST"] ? "Ödeme talebiniz iletildi, bekleniyor..." : undefined,
                  requiresLocation: true,
                },
                {
                  type: "HELP_REQUEST",
                  icon: "ℹ️", title: "Yardım İste", desc: "Bilgi veya destek talebi oluşturun",
                  action: () => sendRequest("HELP_REQUEST"),
                  blocked: false,
                  activeMsg: undefined,
                  requiresLocation: true,
                },
              ].map(item => {
                const isDisabled = item.blocked || (item.requiresLocation && (locationPermission === "denied" || !isWithinRange));
                return (
                <div key={item.type}>
                  <button className="service-btn card" onClick={isDisabled ? undefined : item.action} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px",
                    borderRadius: 16, border: `1px solid ${isDisabled ? "rgba(220,38,38,0.3)" : "var(--border-color)"}`,
                    background: isDisabled ? "rgba(220,38,38,0.04)" : "var(--bg-card)",
                    cursor: isDisabled ? "not-allowed" : "pointer", textAlign: "left",
                    transition: "all 0.15s", width: "100%", opacity: isDisabled ? 0.8 : 1,
                    boxShadow: "var(--shadow-sm)"
                  }}>
                    <span style={{ fontSize: 32, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, color: isDisabled ? "var(--text-muted)" : "var(--text-primary)" }}>{item.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                        {item.activeMsg || 
                         (locationPermission === "denied" && item.requiresLocation ? "🔒 Konum izni gerekli" :
                          !isWithinRange && item.requiresLocation ? "🔒 Restoran dışındasınız" :
                          item.desc)}
                      </p>
                    </div>
                    {item.blocked ? (
                      <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>⏳ Bekliyor</span>
                    ) : (locationPermission === "denied" || !isWithinRange) && item.requiresLocation ? (
                      <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, flexShrink: 0 }}>🔒</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 20 }}>›</span>
                    )}
                  </button>
                </div>
              )}))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Bar ──────────────────────────────────────────────── */}
      <div className="lg:hidden" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg-card)", borderTop: "1px solid var(--border-color)", padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", display: "flex", gap: 10, zIndex: 40, boxShadow: "0 -4px 16px rgba(0,0,0,0.05)" }}>
        <button onClick={() => setShowServiceMenu(true)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-hover)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <span style={{ fontSize: 11 }}>Hizmet</span>
        </button>
        <button onClick={() => setShowCartMobile(true)} disabled={cartCount === 0} style={{
          flex: 3, padding: "12px 16px", borderRadius: 12, border: "none",
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
