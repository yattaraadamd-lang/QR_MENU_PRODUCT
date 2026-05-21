"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const adminMenuItems = [
  { href: "/admin",                  label: "Dashboard",       icon: "▦",  group: "main" },
  { href: "/admin/orders",           label: "Siparişler",      icon: "🧾", group: "ops" },
  { href: "/admin/requests",         label: "Talepler",        icon: "🔔", group: "ops" },
  { href: "/admin/pending-payments", label: "Bekleyen Ödemeler", icon: "⏳", group: "ops" },
  { href: "/admin/payments",         label: "Geçmiş Ödemeler", icon: "💳", group: "ops" },
  { href: "/admin/products",         label: "Ürünler",         icon: "🍽️", group: "menu" },
  { href: "/admin/categories",       label: "Kategoriler",     icon: "📂", group: "menu" },
  { href: "/admin/tables",           label: "Masalar & QR",    icon: "🪑", group: "venue" },
  { href: "/admin/staff",            label: "Personel",        icon: "👥", group: "venue" },
  { href: "/admin/settings",         label: "Ayarlar",         icon: "⚙️", group: "system" },
];

const groups: Record<string, string> = {
  main:   "",
  ops:    "Operasyon",
  menu:   "Menü",
  venue:  "İşletme",
  system: "Sistem",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (session?.user.role !== "ADMIN") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Erişim Engellendi</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Bu sayfaya erişim için admin yetkisi gerekli.</p>
          <button onClick={() => router.push("/auth/signin")} className="btn btn-primary">Giriş Yap</button>
        </div>
      </div>
    );
  }

  const initials = session?.user.name?.slice(0, 2).toUpperCase() || "AD";
  const grouped = Object.entries(groups);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 248,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0, bottom: 0,
        left: sidebarOpen ? 0 : -248,
        zIndex: 50,
        transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
      }} className="lg-left-0">

        {/* Brand */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
              boxShadow: "0 4px 12px var(--primary-glow)",
            }}>🍽️</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>QR Menü</p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>Admin Paneli</p>
            </div>
          </div>
          {session?.user.businessName && (
            <div style={{
              marginTop: 10, padding: "6px 10px",
              background: "var(--bg-hover)", borderRadius: 8,
              fontSize: 12, color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>🏪</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.businessName}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {grouped.map(([groupKey, groupLabel]) => {
            const items = adminMenuItems.filter(i => i.group === groupKey);
            if (!items.length) return null;
            return (
              <div key={groupKey} style={{ marginBottom: 4 }}>
                {groupLabel && (
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: "var(--text-muted)",
                    padding: "8px 10px 4px",
                  }}>{groupLabel}</p>
                )}
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 10px", borderRadius: 8,
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        color: isActive ? "var(--accent-light)" : "var(--text-secondary)",
                        background: isActive ? "var(--primary-glow)" : "transparent",
                        textDecoration: "none", marginBottom: 1,
                        transition: "all 0.15s",
                        borderLeft: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                      }}
                    >
                      <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontWeight: 700, fontSize: 13,
            }}>{initials}</div>
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session?.user.name}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Admin</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", fontSize: 12, justifyContent: "flex-start", gap: 8 }}
          >
            <span>🚪</span> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 0, minWidth: 0 }} className="lg-ml-260">
        {/* Mobile topbar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          position: "sticky", top: 0, zIndex: 30,
        }} className="lg-hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 22, cursor: "pointer", padding: 4 }}
          >☰</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            <span style={{ color: "var(--primary)" }}>QR</span> Menü
          </span>
          <div style={{ width: 30 }} />
        </div>

        <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>
          {children}
        </div>
      </main>

      <style jsx global>{`
        @media (min-width: 1024px) {
          .lg-hidden { display: none !important; }
          .lg-left-0 { left: 0 !important; }
          .lg-ml-260 { margin-left: 248px !important; }
        }
      `}</style>
    </div>
  );
}
