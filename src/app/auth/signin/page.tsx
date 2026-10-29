"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QrCode, Mail, Lock, Loader2, ArrowRight, AlertCircle, ArrowLeft, BellRing, ChefHat, TrendingUp } from "lucide-react";
import Input from "@/components/ui/Input";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "framer-motion";
import { EASE_OUT, fadeUp, stagger } from "@/components/landing/motion";
import Loader from "@/components/ui/Loader";

const HIGHLIGHTS = [
  { icon: BellRing, text: "Siparişler ve garson çağrıları anında ekranınızda" },
  { icon: ChefHat, text: "Masa, ürün ve stok yönetimi tek panelde" },
  { icon: TrendingUp, text: "Günlük ciro ve ödemeler canlı takipte" },
];

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const still = useReducedMotion();

  // Auto-fill based on demo query parameter
  useEffect(() => {
    const demo = searchParams.get("demo");
    if (demo === "admin") {
      setEmail("admin@demo.com");
      setPassword("admin123");
    } else if (demo === "waiter") {
      setEmail("garson@demo.com");
      setPassword("garson123");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.");
      } else {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          const role = data.user?.role;
          if (role === "SUPER_ADMIN") router.push("/super-admin");
          else if (role === "ADMIN") router.push("/admin");
          else router.push("/waiter");
        } else {
          router.push("/admin");
        }
        router.refresh();
      }
    } catch {
      setError("Giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="never">
    <div className="landing-theme grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* ── Marka paneli (desktop) ─────────────────────────────────────────── */}
      <aside
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ background: "linear-gradient(150deg,#F06A3F 0%,#CF411E 40%,#8C2A14 100%)" }}
      >
        <m.div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(244,166,35,0.55), transparent 70%)" }}
          animate={still ? undefined : { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 5, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(42,26,18,0.55), transparent 70%)" }}
        />

        <Link href="/" className="relative flex items-center gap-2.5" style={{ textDecoration: "none", color: "white" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
            <QrCode size={20} />
          </span>
          <span className="font-display text-xl font-semibold">QR Menü</span>
        </Link>

        <m.div className="relative max-w-md" initial="hidden" animate="show" variants={stagger(0.1, 0.15)}>
          <m.div className="mb-8 flex gap-3 text-4xl" variants={stagger(0.08)}>
            {["🍕", "🍔", "🥗", "☕"].map((e, i) => (
              <m.span
                key={e}
                variants={{
                  hidden: { opacity: 0, y: 24, rotate: -12, scale: 0.8 },
                  show: { opacity: 1, y: 0, rotate: 0, scale: 1, transition: { type: "spring", stiffness: 240, damping: 16 } },
                }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(6px)" }}
                whileHover={{ scale: 1.12, rotate: 6 }}
              >
                {/* İç span tek turluk süzülmeyi taşır (≤5 sn, "hareketi azalt"ta hiç); dış span giriş animasyonunu */}
                <m.span
                  animate={still ? undefined : { y: [0, -6, 0] }}
                  transition={{ duration: 3.2, ease: "easeInOut", delay: 1 + i * 0.4 }}
                >
                  {e}
                </m.span>
              </m.span>
            ))}
          </m.div>
          <m.h2 variants={fadeUp} className="font-display text-4xl font-semibold leading-tight">
            Mutfağınızın ritmi, tek ekranda.
          </m.h2>
          <m.ul className="mt-8 flex flex-col gap-4" variants={stagger(0.1)}>
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <m.li
                key={text}
                variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } } }}
                className="flex items-center gap-3 text-[15px] font-medium"
                style={{ color: "rgba(255,255,255,0.92)" }}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.16)" }}>
                  <Icon size={18} />
                </span>
                {text}
              </m.li>
            ))}
          </m.ul>
        </m.div>

        <p className="relative text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          © {new Date().getFullYear()} QR Menü Platformu
        </p>
      </aside>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <main id="main-content" className="flex items-center justify-center px-4 py-10 sm:px-8">
        <m.div className="w-full max-w-[420px]" initial="hidden" animate="show" variants={stagger(0.08, 0.05)}>
          <m.div variants={fadeUp} className="mb-8 text-center lg:text-left">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl lg:hidden"
              style={{ background: "var(--gradient-brand)", boxShadow: "0 10px 24px rgba(217,68,31,0.32)" }}
            >
              <QrCode size={28} color="white" />
            </div>
            <h1 className="font-display text-3xl font-semibold" style={{ color: "#2A1A12" }}>
              Tekrar hoş geldiniz
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#6E4F3F" }}>
              Yönetim panelinize giriş yapın
            </p>
          </m.div>

          <m.div variants={fadeUp} className="card p-7" style={{ borderRadius: 24, boxShadow: "0 20px 50px rgba(68,34,18,0.08)", transition: "border-color 0.2s, box-shadow 0.2s" }}>
            <AnimatePresence initial={false}>
              {error && (
                <m.div
                  key="signin-error"
                  role="alert"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 20, x: [0, -8, 8, -4, 4, 0] }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-medium"
                    style={{ background: "#FDE3E1", border: "1px solid #FBC9C5", color: "#8F2019" }}
                  >
                    <AlertCircle size={16} className="flex-shrink-0" />
                    {error}
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="E-posta adresi"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@isletme.com"
                required
                autoComplete="email"
                leftIcon={<Mail size={18} />}
                style={{ fontSize: 15, minHeight: 48 }}
              />

              <Input
                label="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                showPasswordToggle
                leftIcon={<Lock size={18} />}
                style={{ fontSize: 15, minHeight: 48 }}
              />

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg mt-1 w-full">
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-2 text-center text-[13px]" style={{ color: "#6E4F3F" }}>
              <p>
                İşletmeniz için hesap mı açacaksınız?{" "}
                <Link href="/auth/signup" className="font-bold hover:underline" style={{ color: "#CF411E" }}>
                  Ücretsiz Deneyin
                </Link>
              </p>
              <p>
                Garson hesabınız yok mu?{" "}
                <Link href="/auth/register" className="font-bold hover:underline" style={{ color: "#CF411E" }}>
                  Kayıt Ol
                </Link>
              </p>
            </div>
          </m.div>

          {/* Demo hesapları */}
          <m.div variants={fadeUp} className="mt-4 rounded-2xl p-4" style={{ background: "#FFF1E6", border: "1px dashed #FFC8B0" }}>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "#B23415" }}>
              Demo Hesapları
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { role: "Admin", email: "admin@demo.com", pass: "admin123" },
                { role: "Garson", email: "garson@demo.com", pass: "garson123" },
              ].map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => fillDemo(d.email, d.pass)}
                  className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-left text-[13px] transition-all hover:-translate-y-0.5"
                  style={{ border: "1px solid #F0DFD0", color: "#6E4F3F", cursor: "pointer", boxShadow: "0 1px 2px rgba(68,34,18,0.05)" }}
                >
                  <span className="min-w-0">
                    <strong className="block" style={{ color: "#2A1A12" }}>{d.role}</strong>
                    <span className="block truncate text-xs">{d.email}</span>
                  </span>
                  <ArrowRight size={14} color="#CF411E" className="flex-shrink-0" />
                </button>
              ))}
            </div>
          </m.div>

          <m.div variants={fadeUp} className="mt-6 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline" style={{ color: "#816B5D" }}>
              <ArrowLeft size={14} /> Ana Sayfaya Dön
            </Link>
          </m.div>
        </m.div>
      </main>
    </div>
    </MotionConfig>
    </LazyMotion>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="landing-theme"><Loader fullScreen /></div>}>
      <SignInForm />
    </Suspense>
  );
}
