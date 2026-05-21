"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

const sidebarLinks = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/super-admin/businesses", label: "İşletmeler", icon: "🏪" },
  { href: "/super-admin/users", label: "Kullanıcılar", icon: "👥" },
  { href: "/super-admin/subscriptions", label: "Abonelikler", icon: "💎" },
  { href: "/super-admin/payments", label: "Platform Ödemeleri", icon: "💳" },
  { href: "/super-admin/settings", label: "Ayarlar", icon: "⚙️" },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">Erişim Engellendi</h1>
          <p style={{ color: "var(--text-secondary)" }} className="mb-4">Bu alana sadece Super Admin erişebilir.</p>
          <button onClick={() => router.push("/auth/signin")} className="btn btn-primary">Giriş Yap</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-secondary)" }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }} className="hidden md:flex">
        <div style={{ padding: "24px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            <span style={{ color: "#8b5cf6" }}>QR</span> SaaS Admin
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Super Admin Modu</p>
        </div>

        <nav style={{ flex: 1, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {sidebarLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  textDecoration: "none",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#8b5cf6" : "var(--text-secondary)",
                  background: isActive ? "rgba(139,92,246,0.1)" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 18 }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 20, borderTop: "1px solid var(--border-color)" }}>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start", color: "var(--color-danger)" }}
          >
            🚪 Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile Header */}
        <div className="md:hidden" style={{
          background: "var(--bg-primary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>
            <span style={{ color: "#8b5cf6" }}>QR</span> SaaS
          </h1>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-primary)" }}>
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden" style={{
            position: "fixed", top: 60, left: 0, right: 0, bottom: 0,
            background: "var(--bg-primary)", zIndex: 30, padding: 20,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", padding: "16px", fontSize: 16 }}
              >
                <span style={{ marginRight: 12, fontSize: 20 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="btn btn-ghost"
              style={{ justifyContent: "flex-start", padding: "16px", fontSize: 16, color: "var(--color-danger)", marginTop: "auto" }}
            >
              🚪 Çıkış Yap
            </button>
          </div>
        )}

        <div style={{ padding: "24px 32px", flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
