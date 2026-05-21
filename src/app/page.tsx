"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Navbar */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "white",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
          }}>
            QR
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
            Antigravity<span style={{ color: "var(--primary-light)" }}>Menu</span>
          </span>
        </div>
        
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/auth/signin" className="btn btn-ghost" style={{ border: "none" }}>
            Giriş Yap
          </Link>
          <Link href="/auth/register" className="btn btn-primary" style={{ borderRadius: 20 }}>
            Hemen Başla
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{
        paddingTop: 120,
        paddingBottom: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background Glows */}
        <div style={{
          position: "absolute",
          top: "20%",
          left: "20%",
          width: 400,
          height: 400,
          background: "var(--primary)",
          filter: "blur(120px)",
          opacity: 0.15,
          borderRadius: "50%",
          zIndex: 0,
          animation: "pulse-glow 4s infinite alternate",
        }} />
        <div style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: 300,
          height: 300,
          background: "#8b5cf6",
          filter: "blur(100px)",
          opacity: 0.1,
          borderRadius: "50%",
          zIndex: 0,
        }} />

        {/* Content */}
        <div style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          maxWidth: 800,
          padding: "0 20px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: 30,
            marginBottom: 32,
            color: "var(--primary-light)",
            fontSize: 14,
            fontWeight: 600,
          }}>
            <span style={{ fontSize: 16 }}>🚀</span> Geleceğin Dijital Menü Platformu
          </div>

          <h1 style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "white",
            marginBottom: 24,
            letterSpacing: "-1px",
          }}>
            Müşterilerinize <span style={{
              background: "linear-gradient(to right, #818cf8, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Kusursuz</span> Bir Deneyim Sunun
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "var(--text-secondary)",
            marginBottom: 48,
            maxWidth: 600,
            margin: "0 auto 48px",
            lineHeight: 1.6,
          }}>
            QR kod tabanlı sipariş sistemi, anlık garson çağırma, masa yönetimi ve gelişmiş yönetim paneli ile işletmenizi dijitalleştirin.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/register" className="btn btn-primary" style={{
              padding: "16px 32px",
              fontSize: 18,
              borderRadius: 30,
              boxShadow: "0 10px 30px rgba(99, 102, 241, 0.3)",
            }}>
              Demo'yu Deneyin
            </Link>
            <Link href="/auth/signin" className="btn btn-ghost" style={{
              padding: "16px 32px",
              fontSize: 18,
              borderRadius: 30,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
            }}>
              Giriş Yap
            </Link>
          </div>
        </div>

        {/* Features Showcase */}
        <div style={{
          position: "relative",
          zIndex: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          maxWidth: 1200,
          width: "100%",
          padding: "0 24px",
          marginTop: 80,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(40px)",
          transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        }}>
          {[
            {
              icon: "📱",
              title: "Dijital Menü",
              desc: "Müşterileriniz masadaki QR kodu okutarak anında menünüze ulaşsın.",
            },
            {
              icon: "⚡",
              title: "Anlık Sipariş",
              desc: "Masadan doğrudan mutfağa ve garson paneline düşen hızlı siparişler.",
            },
            {
              icon: "🛎️",
              title: "Hizmet Talepleri",
              desc: "Garson çağırma, ödeme ve temizlik istekleri anında bildirim olarak gelsin.",
            },
          ].map((feature, i) => (
            <div key={i} className="glass" style={{
              padding: 32,
              borderRadius: 24,
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.05)",
              background: "linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8))",
            }}>
              <div style={{
                width: 56,
                height: 56,
                background: "rgba(99, 102, 241, 0.1)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                marginBottom: 20,
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 12 }}>
                {feature.title}
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
