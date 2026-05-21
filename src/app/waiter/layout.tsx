"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationSoundProvider, useNotificationSound } from "@/contexts/NotificationSoundContext";

const NAV = [
  { href: "/waiter",          label: "Siparişler", icon: "🧾" },
  { href: "/waiter/requests", label: "Talepler",   icon: "🔔" },
  { href: "/waiter/payments", label: "Ödemeler",   icon: "💳" },
  { href: "/waiter/tables",   label: "Masalar",    icon: "🪑" },
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
  const { soundEnabled, enableSound, newNotification, notifications, clearNotification, clearAll } = useNotificationSound();
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const unreadCount = notifications.length;

  const notifColors: Record<string, string> = {
    new_order: "#f59e0b",
    call_waiter: "#ef4444",
    payment_request: "#8b5cf6",
    help_request: "#3b82f6",
    service_request: "#10b981",
  };

  function timeAgo(d: Date) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}sn`;
    if (s < 3600) return `${Math.floor(s / 60)}dk`;
    return `${Math.floor(s / 3600)}sa`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 72 }}>
      {/* Notification toast */}
      {newNotification && (
        <div className="toast animate-slide-down" style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
          color: "white", top: 68, zIndex: 60,
        }}>
          {newNotification}
        </div>
      )}

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
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🍽️</div>
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
          {!soundEnabled ? (
            <button onClick={enableSound} className="btn btn-sm animate-pulse-glow" style={{
              background: "#f59e0b", color: "white", border: "none", fontSize: 11, gap: 4,
            }}>
              🔊 Sesi Aç
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Ses Aktif
            </span>
          )}

          {/* ✅ Bildirim butonu */}
          <button
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            style={{
              position: "relative", border: "none",
              cursor: "pointer", padding: 6, borderRadius: 8,
              background: showNotifPanel ? "var(--bg-hover)" : "transparent",
            }}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 0, right: 0,
                background: "#ef4444", color: "white",
                borderRadius: 99, fontSize: 9, fontWeight: 800,
                padding: "1px 4px", minWidth: 16, textAlign: "center",
                lineHeight: "14px",
              }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="btn btn-ghost btn-sm btn-icon" title="Çıkış Yap">🚪</button>
        </div>
      </div>

      {/* ✅ Bildirim Paneli */}
      {showNotifPanel && (
        <div style={{
          position: "fixed", top: 56, right: 0, left: 0, zIndex: 40,
          background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)",
          maxHeight: "50vh", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Bildirimler {unreadCount > 0 && `(${unreadCount})`}</span>
            {unreadCount > 0 && (
              <button onClick={clearAll} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                Tümünü Temizle
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
              Bildirim yok
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: notifColors[n.type] ? `${notifColors[n.type]}18` : "var(--primary-glow)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>{n.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: notifColors[n.type] || "var(--primary-light)" }}>{n.title}</p>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{n.message}</p>
                </div>
                <button onClick={() => clearNotification(n.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 2, flexShrink: 0 }}>✕</button>
              </div>
            ))
          )}
        </div>
      )}

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
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "10px 4px 6px",
              textDecoration: "none", fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? "var(--accent-light)" : "var(--text-secondary)",
              position: "relative", transition: "color 0.15s",
            }}>
              {active && (
                <span style={{
                  position: "absolute", top: 0, left: "20%", right: "20%",
                  height: 2, background: "var(--primary)", borderRadius: "0 0 4px 4px",
                }} />
              )}
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
