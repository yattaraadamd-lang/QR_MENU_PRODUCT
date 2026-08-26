"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  QrCode,
  ShoppingCart,
  Users,
  LayoutDashboard,
  Table2,
  CreditCard,
  BarChart3,
  Package,
  ChevronRight,
  ArrowRight,
  Smartphone,
  MousePointerClick,
  Monitor,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  { icon: <QrCode size={24} />, title: "QR Menü", desc: "Masadaki QR kodu okutarak menüye anında erişim" },
  { icon: <ShoppingCart size={24} />, title: "Online Sipariş", desc: "Müşteriler doğrudan telefondan sipariş verir" },
  { icon: <Users size={24} />, title: "Garson Paneli", desc: "Siparişleri anlık takip edin ve yönetin" },
  { icon: <LayoutDashboard size={24} />, title: "Admin Paneli", desc: "İşletmenizi tek ekrandan kontrol edin" },
  { icon: <Table2 size={24} />, title: "Masa Yönetimi", desc: "Tüm masaların durumunu canlı görün" },
  { icon: <CreditCard size={24} />, title: "Ödeme Takibi", desc: "Hesap açma, kapama ve ödeme onayı" },
  { icon: <BarChart3 size={24} />, title: "Ciro Raporlama", desc: "Günlük ve aylık gelir analizleri" },
  { icon: <Package size={24} />, title: "Ürün Yönetimi", desc: "Kategori, stok ve fiyat kontrolü" },
];

const DEMOS = [
  {
    icon: <Smartphone size={32} />,
    title: "Müşteri Demo",
    desc: "QR menüyü görüntüleyin, ürünleri sepete ekleyin ve sipariş akışını test edin.",
    color: "#D97706",
    bg: "rgba(217,119,6,0.08)",
    borderColor: "rgba(217,119,6,0.2)",
    href: "/menu/demo-business-id/1",
  },
  {
    icon: <MousePointerClick size={32} />,
    title: "Garson Demo",
    desc: "Gelen siparişleri yönetin, masa durumlarını takip edin ve ödeme taleplerini görün.",
    color: "#059669",
    bg: "rgba(5,150,105,0.08)",
    borderColor: "rgba(5,150,105,0.2)",
    href: "/auth/signin?demo=waiter",
  },
  {
    icon: <Monitor size={32} />,
    title: "Admin Demo",
    desc: "Ciro, ürün, masa, kategori ve personel yönetimini deneyimleyin.",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    borderColor: "rgba(37,99,235,0.2)",
    href: "/auth/signin?demo=admin",
  },
];

const STEPS = [
  {
    num: "01",
    title: "QR Kodu Okutun",
    desc: "Müşteri masadaki QR kodu telefonuyla tarar.",
  },
  {
    num: "02",
    title: "Sipariş Verin",
    desc: "Menüden ürün seçip sepete ekler ve siparişi gönderir.",
  },
  {
    num: "03",
    title: "Yönetin",
    desc: "Garson ve admin panelinden tüm süreç kolayca yönetilir.",
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="landing-theme" style={{ minHeight: "100vh" }}>
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          padding: "0 24px",
          height: 64,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(248,250,252,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(226,232,240,0.8)",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #D97706, #B45309)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(217,119,6,0.3)",
            }}
          >
            <QrCode size={20} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>
            QR<span style={{ color: "#D97706" }}>Menü</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowDemoModal(true)}
            className="btn btn-ghost"
            style={{ fontSize: 14, borderRadius: 10, padding: "8px 16px", minHeight: 36 }}
          >
            Demoyu Deneyin
          </button>
          <Link
            href="/auth/signin"
            className="btn btn-primary"
            style={{ fontSize: 14, borderRadius: 10, padding: "8px 20px", minHeight: 36 }}
          >
            Giriş Yapın
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section
        style={{
          paddingTop: 140,
          paddingBottom: 80,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decorations */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "5%",
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "5%",
            width: 300,
            height: 300,
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "0 24px",
            position: "relative",
            zIndex: 1,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.15)",
              borderRadius: 99,
              marginBottom: 28,
              color: "#B45309",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Sparkles size={14} />
            Restoran ve Kafeler İçin Geliştirildi
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.15,
              color: "#0F172A",
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            Modern{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #D97706, #F59E0B)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              QR Menü
            </span>{" "}
            Sistemi
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(15px, 1.8vw, 18px)",
              color: "#64748B",
              marginBottom: 40,
              maxWidth: 600,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            Müşteriler QR kod ile menüyü görüntüler, sipariş verir; garsonlar siparişleri
            yönetir, admin paneliyle masa, ürün, ödeme ve ciro takibi kolayca yapılır.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setShowDemoModal(true)}
              className="btn btn-primary btn-lg"
              style={{
                borderRadius: 14,
                fontSize: 16,
                padding: "14px 32px",
                gap: 8,
              }}
            >
              Demoyu Deneyin
              <ArrowRight size={18} />
            </button>
            <Link
              href="/auth/signin"
              className="btn btn-ghost btn-lg"
              style={{
                borderRadius: 14,
                fontSize: 16,
                padding: "14px 32px",
              }}
            >
              Giriş Yapın
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 80px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(30px)",
          transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 12,
            }}
          >
            Tüm İhtiyaçlarınız Tek Platformda
          </h2>
          <p style={{ color: "#64748B", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Restoranınızı dijitalleştirmek için ihtiyacınız olan her şey
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: "24px",
                borderRadius: 16,
                cursor: "default",
                transition: "all 0.25s ease",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "rgba(217,119,6,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#D97706",
                  marginBottom: 16,
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section
        style={{
          background: "#FFFFFF",
          borderTop: "1px solid #F1F5F9",
          borderBottom: "1px solid #F1F5F9",
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                marginBottom: 12,
              }}
            >
              Nasıl Çalışır?
            </h2>
            <p style={{ color: "#64748B", fontSize: 16 }}>
              3 basit adımda hizmete başlayın
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 32,
            }}
          >
            {STEPS.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: "linear-gradient(135deg, #D97706, #F59E0B)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    color: "white",
                    fontSize: 22,
                    fontWeight: 800,
                    boxShadow: "0 8px 24px rgba(217,119,6,0.25)",
                  }}
                >
                  {s.num}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Section (Inline) ──────────────────────────────────────────── */}
      <section
        id="demo"
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "80px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 12,
            }}
          >
            Hemen Deneyin
          </h2>
          <p style={{ color: "#64748B", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Herhangi bir demo rolü seçerek sistemi canlı deneyimleyin
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {DEMOS.map((d, i) => (
            <Link
              key={i}
              href={d.href}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card"
                style={{
                  padding: 28,
                  borderRadius: 20,
                  cursor: "pointer",
                  border: `1.5px solid ${d.borderColor}`,
                  transition: "all 0.25s ease",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: d.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: d.color,
                    marginBottom: 20,
                  }}
                >
                  {d.icon}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 8,
                  }}
                >
                  {d.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#64748B",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {d.desc}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 14,
                    fontWeight: 600,
                    color: d.color,
                  }}
                >
                  Deneyimle <ChevronRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer / CTA ───────────────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 800,
              color: "white",
              marginBottom: 14,
            }}
          >
            İşletmenizi Dijitalleştirmeye Hazır Mısınız?
          </h2>
          <p
            style={{
              color: "#94A3B8",
              fontSize: 15,
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            QR menü, sipariş takibi, garson paneli ve admin yönetimiyle restoranınızı
            geleceğe taşıyın.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/auth/register"
              className="btn btn-lg"
              style={{
                background: "linear-gradient(135deg, #D97706, #F59E0B)",
                color: "white",
                borderRadius: 14,
                fontSize: 16,
                padding: "14px 32px",
                boxShadow: "0 4px 20px rgba(217,119,6,0.35)",
                gap: 8,
              }}
            >
              Hemen Başla <ArrowRight size={18} />
            </Link>
          </div>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 24 }}>
            © {new Date().getFullYear()} QR Menü Platformu. Tüm hakları saklıdır.
          </p>
        </div>
      </section>

      {/* ── Demo Modal ─────────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div className="modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              padding: 0,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Demo Seçin</h2>
              <button
                onClick={() => setShowDemoModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#F1F5F9",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#64748B",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 4 }}>
                Aşağıdaki rollerden birini seçerek demo hesabıyla giriş yapın:
              </p>
              {DEMOS.map((d, i) => (
                <Link
                  key={i}
                  href={d.href}
                  onClick={() => setShowDemoModal(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    border: `1.5px solid ${d.borderColor}`,
                    background: d.bg,
                    textDecoration: "none",
                    transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: d.color,
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    {d.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{d.title}</p>
                    <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{d.desc}</p>
                  </div>
                  <ChevronRight size={18} color={d.color} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
