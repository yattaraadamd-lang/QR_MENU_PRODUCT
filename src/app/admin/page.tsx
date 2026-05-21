"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor", ACCEPTED: "Kabul Edildi", PREPARING: "Hazırlanıyor",
  SERVED: "Tamamlandı", CANCELLED: "İptal", REJECTED: "Reddedildi",
};
const statusBadge: Record<string, string> = {
  PENDING: "badge-warning", ACCEPTED: "badge-info", PREPARING: "badge-primary",
  SERVED: "badge-success", CANCELLED: "badge-danger", REJECTED: "badge-danger",
};

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    todayRevenue: 0, monthlyRevenue: 0, todayOrderCount: 0,
    pendingOrderCount: 0, activeRequestCount: 0, paymentRequestCount: 0,
    occupiedTableCount: 0, totalTableCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideRevenue, setHideRevenue] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("admin_hide_revenue") === "true"
  );

  useEffect(() => {
    if (session?.user.businessId) {
      fetchData();
      const iv = setInterval(fetchData, 10000);
      return () => clearInterval(iv);
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/dashboard/summary");
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
        setRecentOrders(data.data.recentOrders || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleRevenue = () => {
    const v = !hideRevenue;
    setHideRevenue(v);
    localStorage.setItem("admin_hide_revenue", String(v));
  };

  const fmt = (v: number) => hideRevenue ? "••••" : new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, color: "var(--text-secondary)" }}>
      <span className="animate-spin" style={{ display: "inline-block", width: 20, height: 20, border: "2px solid var(--border-color)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
      Yükleniyor...
    </div>
  );

  const kpiCards = [
    { label: "Bugünkü Ciro",    value: fmt(stats.todayRevenue),    icon: "💸", color: "#10b981", bg: "rgba(16,185,129,0.08)", isRev: true },
    { label: "Aylık Ciro",      value: fmt(stats.monthlyRevenue),  icon: "📈", color: "#6366f1", bg: "rgba(99,102,241,0.08)", isRev: true },
    { label: "Bugün Sipariş",   value: stats.todayOrderCount,      icon: "🧾", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
    { label: "Bekleyen",        value: stats.pendingOrderCount,    icon: "⏳", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
    { label: "Aktif Talep",     value: stats.activeRequestCount,   icon: "🔔", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
    { label: "Ödeme Talebi",    value: stats.paymentRequestCount,  icon: "💳", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
    { label: "Dolu Masa",       value: `${stats.occupiedTableCount}/${stats.totalTableCount}`, icon: "🪑", color: "#06b6d4", bg: "rgba(6,182,212,0.08)" },
  ];

  const quickLinks = [
    { href: "/admin/orders",   icon: "🧾", label: "Siparişler",   color: "#3b82f6" },
    { href: "/admin/products", icon: "🍽️", label: "Ürünler",      color: "#6366f1" },
    { href: "/admin/tables",   icon: "🪑", label: "Masalar",      color: "#10b981" },
    { href: "/admin/requests", icon: "🔔", label: "Talepler",     color: "#f59e0b" },
    { href: "/admin/payments", icon: "💳", label: "Ödemeler",     color: "#8b5cf6" },
    { href: "/admin/staff",    icon: "👥", label: "Personel",     color: "#ef4444" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 3 }}>
            Hoş geldiniz, {session?.user.name} 👋
          </p>
        </div>
        <button onClick={toggleRevenue} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
          {hideRevenue ? "👁️ Ciroyu Göster" : "🙈 Ciroyu Gizle"}
        </button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        {kpiCards.map((k, i) => (
          <div key={i} style={{
            background: "var(--bg-card)", border: "1px solid var(--border-color)",
            borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden",
            transition: "all 0.2s",
          }}>
            {/* Accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.color, borderRadius: "14px 14px 0 0" }} />
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: k.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, marginBottom: 10,
            }}>{k.icon}</div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {k.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom grid: recent orders + quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
        {/* Recent Orders */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Son Siparişler</h3>
            <Link href="/admin/orders" style={{ color: "var(--primary-light)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Tümünü Gör →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: 13 }}>Henüz sipariş yok</p>
            </div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} style={{
                padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background 0.15s",
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>
                    {order.table?.tableName || `Masa ${order.table?.tableNumber}`}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {order.items?.length} ürün · {Number(order.totalPrice).toFixed(2)} ₺ · {new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`badge ${statusBadge[order.status] || "badge-neutral"}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick Links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 220 }}>
          {quickLinks.map((q) => (
            <Link key={q.href} href={q.href} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "16px 12px", borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border-color)",
              textDecoration: "none", transition: "all 0.2s",
              color: "var(--text-primary)",
            }}>
              <span style={{ fontSize: 24 }}>{q.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{q.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
