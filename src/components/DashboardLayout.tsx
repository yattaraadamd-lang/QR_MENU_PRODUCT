"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export default function DashboardLayout({
  children,
  navItems,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header - Sticky and Modern */}
      <header style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden btn btn-ghost btn-sm"
              style={{ padding: "6px" }}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>

            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: 17,
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {session?.user.businessName}
              </h1>
              <p style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 2,
              }}>
                {session?.user.name} · {session?.user.role === "ADMIN" ? "Admin" : "Garson"}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn btn-ghost btn-sm"
            style={{
              color: "var(--danger)",
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Çıkış
          </button>
        </div>
      </header>

      {/* Navigation - Desktop Horizontal, Mobile Dropdown */}
      <nav style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        {/* Desktop Navigation */}
        <div className="hidden lg:block">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                    pathname === item.href
                      ? "border-primary text-[var(--primary-light)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]"
                  }`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Navigation (Dropdown) */}
        {mobileMenuOpen && (
          <div className="lg:hidden" style={{
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border-color)",
            animation: "slideDown 0.2s ease",
          }}>
            <div className="px-4 py-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: pathname === item.href ? "var(--primary-light)" : "var(--text-secondary)",
                    background: pathname === item.href ? "var(--primary-glow)" : "transparent",
                    textDecoration: "none",
                    transition: "all 0.15s",
                    marginBottom: 4,
                  }}
                  className={pathname === item.href ? "" : "hover:bg-[var(--bg-hover)]"}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {pathname === item.href && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
