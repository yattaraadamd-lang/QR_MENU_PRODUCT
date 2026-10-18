"use client";

import Link from "next/link";
import { useState } from "react";
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
  ConciergeBell,
  Monitor,
  Sparkles,
  Clock,
  CircleCheck,
  BellRing,
  TrendingUp,
  X,
  UtensilsCrossed,
} from "lucide-react";

// Özellik kartlarının ikon renkleri iştah açıcı palette döner
const TONES = [
  { fg: "#D9441F", bg: "#FFE9DF" }, // paprika
  { fg: "#B4600C", bg: "#FEF0C7" }, // safran
  { fg: "#2E8B47", bg: "#E3F3E6" }, // fesleğen
  { fg: "#B3261E", bg: "#FDE3E1" }, // domates
];

const FEATURES = [
  { icon: QrCode, title: "QR Menü", desc: "Masadaki QR kodu okutarak menüye anında erişim" },
  { icon: ShoppingCart, title: "Online Sipariş", desc: "Müşteriler doğrudan telefondan sipariş verir" },
  { icon: Users, title: "Garson Paneli", desc: "Siparişleri anlık takip edin ve yönetin" },
  { icon: LayoutDashboard, title: "Admin Paneli", desc: "İşletmenizi tek ekrandan kontrol edin" },
  { icon: Table2, title: "Masa Yönetimi", desc: "Tüm masaların durumunu canlı görün" },
  { icon: CreditCard, title: "Ödeme Takibi", desc: "Hesap açma, kapama ve ödeme onayı" },
  { icon: BarChart3, title: "Ciro Raporlama", desc: "Günlük ve aylık gelir analizleri" },
  { icon: Package, title: "Ürün Yönetimi", desc: "Kategori, stok ve fiyat kontrolü" },
];

const DEMOS = [
  {
    icon: Smartphone,
    title: "Müşteri Demo",
    desc: "QR menüyü görüntüleyin, ürünleri sepete ekleyin ve sipariş akışını test edin.",
    tone: TONES[0],
    href: "/menu/demo-business-id/1",
  },
  {
    icon: ConciergeBell,
    title: "Garson Demo",
    desc: "Gelen siparişleri yönetin, masa durumlarını takip edin ve ödeme taleplerini görün.",
    tone: TONES[2],
    href: "/auth/signin?demo=waiter",
  },
  {
    icon: Monitor,
    title: "Admin Demo",
    desc: "Ciro, ürün, masa, kategori ve personel yönetimini deneyimleyin.",
    tone: TONES[1],
    href: "/auth/signin?demo=admin",
  },
];

const STEPS = [
  { num: "01", icon: QrCode, title: "QR Kodu Okutun", desc: "Müşteri masadaki QR kodu telefonuyla tarar, uygulama indirmeden menü açılır." },
  { num: "02", icon: UtensilsCrossed, title: "Sipariş Verin", desc: "Fotoğraflı menüden ürün seçer, sepete ekler ve siparişi gönderir." },
  { num: "03", icon: TrendingUp, title: "Yönetin", desc: "Garson ve admin panelinden sipariş, ödeme ve ciro canlı takip edilir." },
];

const PREVIEW_ITEMS = [
  { emoji: "🍕", name: "Margherita Pizza", desc: "Taş fırın, mozzarella, fesleğen", price: "245", bg: "linear-gradient(135deg,#FDBA74,#D9441F)", popular: true },
  { emoji: "🥗", name: "Akdeniz Salata", desc: "Roka, nar, keçi peyniri", price: "165", bg: "linear-gradient(135deg,#BBE2C1,#2E8B47)" },
  { emoji: "☕", name: "Türk Kahvesi", desc: "Lokum ile servis", price: "70", bg: "linear-gradient(135deg,#E7C9A9,#6E4F3F)" },
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      {/* Sıcak ışık halesi */}
      <div
        aria-hidden
        className="absolute -inset-10 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(244,166,35,0.35), rgba(217,68,31,0.15) 50%, transparent 70%)" }}
      />

      <div
        className="relative rounded-[42px] p-3"
        style={{ background: "#2A1A12", boxShadow: "0 40px 80px rgba(68,34,18,0.35), inset 0 0 0 2px #4A3428" }}
      >
        <div className="overflow-hidden rounded-[32px]" style={{ background: "#FFF8F1" }}>
          {/* Menü başlığı */}
          <div className="px-4 pb-5 pt-6 text-white" style={{ background: "linear-gradient(160deg,#F06A3F,#D9441F 55%,#B23415)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: "rgba(255,255,255,0.18)" }}>
                🍽️
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold leading-tight">Lezzet Durağı</p>
                <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(255,255,255,0.22)" }}>
                  Masa 5 · ✓ Aktif
                </span>
              </div>
            </div>
          </div>

          {/* Kategori çipleri */}
          <div className="flex gap-2 overflow-hidden px-4 py-3">
            {["🔥 Popüler", "🍕 Pizza", "🥗 Salata", "☕ İçecek"].map((c, i) => (
              <span
                key={c}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={
                  i === 0
                    ? { background: "#D9441F", color: "white", boxShadow: "0 4px 10px rgba(217,68,31,0.3)" }
                    : { background: "white", color: "#6E4F3F", border: "1px solid #F0DFD0" }
                }
              >
                {c}
              </span>
            ))}
          </div>

          {/* Ürünler */}
          <div className="flex flex-col gap-2.5 px-4 pb-4">
            {PREVIEW_ITEMS.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-2xl bg-white p-2.5" style={{ border: "1px solid #F0DFD0" }}>
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-3xl" style={{ background: p.bg }}>
                  {p.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold" style={{ color: "#2A1A12" }}>
                    {p.name}
                    {p.popular && <span className="ml-1 text-[10px]" style={{ color: "#B3261E" }}>★</span>}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "#A68A78" }}>{p.desc}</p>
                  <p className="mt-0.5 text-[14px] font-extrabold" style={{ color: "#D9441F" }}>{p.price} ₺</p>
                </div>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: "#D9441F" }}>
                  +
                </span>
              </div>
            ))}
          </div>

          {/* Sepet barı */}
          <div className="px-4 pb-5">
            <div
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#F06A3F,#D9441F)", boxShadow: "0 8px 18px rgba(217,68,31,0.35)" }}
            >
              <span className="rounded-full px-2 text-[12px]" style={{ background: "rgba(255,255,255,0.25)" }}>3</span>
              Sepet · 480,00 ₺
            </div>
          </div>
        </div>
      </div>

      {/* Yüzen bildirim kartları */}
      <div
        className="absolute -left-6 top-24 hidden items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:flex animate-float"
        style={{ boxShadow: "0 14px 34px rgba(68,34,18,0.16)", border: "1px solid #F0DFD0" }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "#E3F3E6", color: "#2E8B47" }}>
          <BellRing size={16} />
        </span>
        <div>
          <p className="text-[12px] font-bold" style={{ color: "#2A1A12" }}>Yeni sipariş</p>
          <p className="text-[11px]" style={{ color: "#A68A78" }}>Masa 5 · az önce</p>
        </div>
      </div>
      <div
        className="absolute -right-6 bottom-28 hidden items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:flex animate-float"
        style={{ boxShadow: "0 14px 34px rgba(68,34,18,0.16)", border: "1px solid #F0DFD0", animationDelay: "1.2s" }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "#FEF0C7", color: "#B4600C" }}>
          <TrendingUp size={16} />
        </span>
        <div>
          <p className="text-[11px]" style={{ color: "#A68A78" }}>Bugünkü ciro</p>
          <p className="text-[13px] font-extrabold" style={{ color: "#2A1A12" }}>₺12.480</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "#D9441F" }}>
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: "#2A1A12" }}>
        {title}
      </h2>
      <p className="mt-3 text-base" style={{ color: "#6E4F3F" }}>{desc}</p>
    </div>
  );
}

export default function HomePage() {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className="landing-theme min-h-screen overflow-x-hidden">
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 top-0 z-50"
        style={{ background: "rgba(255,248,241,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(240,223,208,0.9)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-brand)", boxShadow: "0 6px 16px rgba(217,68,31,0.32)" }}
            >
              <QrCode size={19} color="white" />
            </span>
            <span className="font-display text-xl font-semibold" style={{ color: "#2A1A12" }}>
              QR<span style={{ color: "#D9441F" }}>Menü</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm font-semibold md:flex" style={{ color: "#6E4F3F" }}>
            <a href="#ozellikler" className="transition-colors hover:text-[#D9441F]">Özellikler</a>
            <a href="#nasil-calisir" className="transition-colors hover:text-[#D9441F]">Nasıl Çalışır</a>
            <a href="#demo" className="transition-colors hover:text-[#D9441F]">Demo</a>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowDemoModal(true)} className="btn btn-ghost hidden sm:inline-flex">
              Demoyu Deneyin
            </button>
            <Link href="/auth/signin" className="btn btn-primary">
              Giriş Yapın
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative px-4 pb-20 pt-28 sm:px-6 lg:pt-36">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-slide-up text-center lg:text-left">
            <span
              className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
              style={{ background: "#FFE9DF", color: "#B23415", border: "1px solid #FFC8B0" }}
            >
              <Sparkles size={14} />
              Restoran ve Kafeler İçin Geliştirildi
            </span>

            <h1
              className="font-display font-semibold"
              style={{ fontSize: "clamp(36px, 5.4vw, 64px)", lineHeight: 1.06, color: "#2A1A12" }}
            >
              Restoran ve Kafeler İçin <span className="text-gradient-warm">Modern QR Menü</span> Sistemi
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed lg:mx-0" style={{ color: "#6E4F3F" }}>
              Müşteriler QR kod ile iştah açan, fotoğraflı menüyü görüntüler ve sipariş verir; garsonlar
              siparişleri yönetir, admin paneliyle masa, ürün, ödeme ve ciro takibi kolayca yapılır.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <button onClick={() => setShowDemoModal(true)} className="btn btn-primary btn-lg">
                Demoyu Deneyin <ArrowRight size={18} />
              </button>
              <Link href="/auth/signin" className="btn btn-ghost btn-lg">
                Giriş Yapın
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-semibold lg:justify-start" style={{ color: "#6E4F3F" }}>
              {[
                { icon: Clock, text: "5 dakikada kurulum" },
                { icon: Smartphone, text: "Uygulama gerekmez" },
                { icon: CircleCheck, text: "Canlı sipariş takibi" },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1.5">
                  <Icon size={16} color="#2E8B47" />
                  {text}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-fade-in">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ── Özellikler ─────────────────────────────────────────────────────── */}
      <section id="ozellikler" className="scroll-mt-20 px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Özellikler"
            title="Tüm İhtiyaçlarınız Tek Platformda"
            desc="Menüden kasaya, restoranınızı dijitalleştirmek için ihtiyacınız olan her şey"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => {
              const tone = TONES[i % TONES.length];
              const Icon = f.icon;
              return (
                <div key={f.title} className="card p-6" style={{ borderRadius: 20 }}>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: tone.bg, color: tone.fg }}>
                    <Icon size={22} />
                  </div>
                  <h3 className="mb-1.5 text-base font-bold" style={{ color: "#2A1A12" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6E4F3F" }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Nasıl Çalışır ──────────────────────────────────────────────────── */}
      <section id="nasil-calisir" className="scroll-mt-20 px-4 py-24 sm:px-6" style={{ background: "#FFFFFF", borderTop: "1px solid #F8ECE1", borderBottom: "1px solid #F8ECE1" }}>
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="Nasıl Çalışır?" title="3 basit adımda hizmete başlayın" desc="Masadan mutfağa, siparişten ödemeye kesintisiz bir akış" />
          <div className="relative grid gap-10 md:grid-cols-3">
            <div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-8 hidden h-0.5 md:block"
              style={{ background: "repeating-linear-gradient(90deg,#FFC8B0 0 10px,transparent 10px 18px)" }}
            />
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="relative text-center">
                  <div
                    className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
                    style={{ background: "var(--gradient-warm)", boxShadow: "0 12px 28px rgba(217,68,31,0.28)" }}
                  >
                    <Icon size={26} />
                    <span
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-extrabold"
                      style={{ color: "#D9441F", boxShadow: "0 2px 8px rgba(68,34,18,0.15)" }}
                    >
                      {s.num}
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-semibold" style={{ color: "#2A1A12" }}>{s.title}</h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed" style={{ color: "#6E4F3F" }}>{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Demo ───────────────────────────────────────────────────────────── */}
      <section id="demo" className="scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="Canlı Demo" title="Hemen Deneyin" desc="Bir demo rolü seçerek sistemi canlı deneyimleyin" />
          <div className="grid gap-5 md:grid-cols-3">
            {DEMOS.map((d) => {
              const Icon = d.icon;
              return (
                <Link key={d.title} href={d.href} className="group" style={{ textDecoration: "none" }}>
                  <div className="card flex h-full flex-col p-7 group-hover:-translate-y-1" style={{ borderRadius: 24 }}>
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: d.tone.bg, color: d.tone.fg }}>
                      <Icon size={28} />
                    </div>
                    <h3 className="mb-2 font-display text-xl font-semibold" style={{ color: "#2A1A12" }}>{d.title}</h3>
                    <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: "#6E4F3F" }}>{d.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: d.tone.fg }}>
                      Deneyimle <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA / Footer ───────────────────────────────────────────────────── */}
      <section className="px-4 pb-10 sm:px-6">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-12"
          style={{ background: "linear-gradient(140deg,#2A1A12 0%,#17110E 100%)" }}
        >
          <div
            aria-hidden
            className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(240,106,63,0.45), rgba(244,166,35,0.2) 50%, transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
              İşletmenizi Dijitalleştirmeye Hazır Mısınız?
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "#C3A893" }}>
              QR menü, sipariş takibi, garson paneli ve admin yönetimiyle restoranınızı geleceğe taşıyın.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/auth/signup" className="btn btn-primary btn-lg">
                Hemen Başla <ArrowRight size={18} />
              </Link>
              <button
                onClick={() => setShowDemoModal(true)}
                className="btn btn-lg"
                style={{ background: "rgba(255,255,255,0.08)", color: "#FBEFE3", border: "1px solid rgba(255,255,255,0.16)" }}
              >
                Demoyu Deneyin
              </button>
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-[13px]" style={{ color: "#A68A78" }}>
          © {new Date().getFullYear()} QR Menü Platformu. Tüm hakları saklıdır.
        </p>
      </section>

      {/* ── Demo Modal ─────────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div className="modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, padding: 0, borderRadius: 28 }}>
            <div className="flex items-center justify-between px-6 pb-4 pt-5" style={{ borderBottom: "1px solid #F8ECE1" }}>
              <h2 className="font-display text-2xl font-semibold" style={{ color: "#2A1A12" }}>Demo Seçin</h2>
              <button
                onClick={() => setShowDemoModal(false)}
                aria-label="Kapat"
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "#FFF1E6", color: "#6E4F3F", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-6 pb-6 pt-4">
              <p className="mb-1 text-sm" style={{ color: "#6E4F3F" }}>
                Aşağıdaki rollerden birini seçerek demo hesabıyla giriş yapın:
              </p>
              {DEMOS.map((d) => {
                const Icon = d.icon;
                return (
                  <Link
                    key={d.title}
                    href={d.href}
                    onClick={() => setShowDemoModal(false)}
                    className="flex items-center gap-3.5 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
                    style={{ border: `1.5px solid ${d.tone.bg}`, background: `${d.tone.bg}80`, textDecoration: "none" }}
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white" style={{ color: d.tone.fg, boxShadow: "0 1px 3px rgba(68,34,18,0.08)" }}>
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold" style={{ color: "#2A1A12" }}>{d.title}</span>
                      <span className="mt-0.5 block text-xs" style={{ color: "#6E4F3F" }}>{d.desc}</span>
                    </span>
                    <ChevronRight size={18} color={d.tone.fg} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
