"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import { NotificationPanel } from "@/components/NotificationPanel";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { ClipboardList, Bell, CreditCard, Table2, LogOut, QrCode } from "lucide-react";

const NAV = [
  { href: "/waiter",          label: "Siparişler", icon: <ClipboardList size={22} /> },
  { href: "/waiter/requests", label: "Talepler",   icon: <Bell size={22} /> },
  { href: "/waiter/payments", label: "Ödemeler",   icon: <CreditCard size={22} /> },
  { href: "/waiter/tables",   label: "Masalar",    icon: <Table2 size={22} /> },
];

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();

  if (session?.user.role !== "WAITER" && session?.user.role !== "ADMIN") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Erişim Engellendi</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Garson veya admin yetkisi gerekli.</p>
          <button onClick={() => router.push("/auth/signin")} className="btn btn-primary">Giriş Yap</button>
        </div>
      </div>
    );
  }

  return (
    <NotificationSoundProvider>
      <WaiterContent>{children}</WaiterContent>
    </NotificationSoundProvider>
  );
}

function WaiterContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { counts } = useBadgeCounts(); // ✅ PERF: default 30sn (önceki: 8sn)

  const badgeMap: Record<string, number> = {
    "/waiter":          counts.orders,
    "/waiter/requests": counts.requests,
    "/waiter/payments": counts.payments,
    "/waiter/tables":   counts.payments,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 72 }}>
      {/* Top bar */}
      <div style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-color)",
        padding: "0 16px",
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px var(--primary-glow)",
          }}>
            <QrCode size={18} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
              {session?.user.name || "Garson"}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.2 }}>
              {session?.user.businessName}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Integrated Premium Notification System (Bell + Sound Control + Toast + Glassmorphism Panel) */}
          <NotificationPanel />

          <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="btn btn-ghost btn-sm btn-icon" title="Çıkış Yap" style={{ color: "var(--text-secondary)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 14px" }}>
        {children}
      </div>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
        display: "flex",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 30,
      }}>
        {NAV.map(item => {
          const active = pathname === item.href;
          const badge = badgeMap[item.href] || 0;
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "10px 4px 6px",
              textDecoration: "none", fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? "var(--primary-light)" : "var(--text-secondary)",
              position: "relative", transition: "color 0.15s",
            }}>
              {active && (
                <span style={{
                  position: "absolute", top: 0, left: "20%", right: "20%",
                  height: 2, background: "var(--primary)", borderRadius: "0 0 4px 4px",
                }} />
              )}
              <span style={{ position: "relative", display: "inline-flex" }}>
                {item.icon}
                {badge > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -4, right: -8,
                    background: "#ef4444",
                    color: "white",
                    borderRadius: 99,
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 4px",
                    minWidth: 15,
                    textAlign: "center",
                    lineHeight: "13px",
                    animation: "pulse-glow 2s infinite",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
