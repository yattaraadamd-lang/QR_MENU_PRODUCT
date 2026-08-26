"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QrCode, Mail, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Input from "@/components/ui/Input";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div
      className="landing-theme"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "linear-gradient(145deg, #F8FAFC 0%, #FEF7ED 50%, #F8FAFC 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorations */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "5%",
          width: 350,
          height: 350,
          background: "radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 1 }}>
        {/* Logo & Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #D97706, #B45309)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(217,119,6,0.3)",
            }}
          >
            <QrCode size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
            QR Menü Platformu
          </h1>
          <p style={{ color: "#64748B", fontSize: 14, marginTop: 6 }}>
            Yönetim panelinize giriş yapın
          </p>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 20,
            padding: "28px 28px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {/* Error */}
          {error && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.15)",
                borderRadius: 12,
                color: "#B91C1C",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
              label="E-posta adresi"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@isletme.com"
              required
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              style={{ fontSize: 15 }}
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
              style={{ fontSize: 15 }}
            />

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 4, fontSize: 15, borderRadius: 12, gap: 8 }}
            >
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

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <p style={{ fontSize: 13, color: "#64748B" }}>
              Garson hesabınız yok mu?{" "}
              <Link
                href="/auth/register"
                style={{ color: "#D97706", fontWeight: 600, textDecoration: "none" }}
              >
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div
          style={{
            marginTop: 16,
            padding: "16px 20px",
            background: "rgba(217,119,6,0.04)",
            border: "1px solid rgba(217,119,6,0.12)",
            borderRadius: 16,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#B45309",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            Demo Hesapları
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={() => fillDemo("admin@demo.com", "admin123")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(217,119,6,0.12)",
                background: "white",
                cursor: "pointer",
                transition: "all 0.15s",
                fontSize: 13,
                color: "#475569",
              }}
            >
              <span>
                <strong style={{ color: "#0F172A" }}>Admin</strong> · admin@demo.com
              </span>
              <ArrowRight size={14} color="#D97706" />
            </button>
            <button
              onClick={() => fillDemo("garson@demo.com", "garson123")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(217,119,6,0.12)",
                background: "white",
                cursor: "pointer",
                transition: "all 0.15s",
                fontSize: 13,
                color: "#475569",
              }}
            >
              <span>
                <strong style={{ color: "#0F172A" }}>Garson</strong> · garson@demo.com
              </span>
              <ArrowRight size={14} color="#D97706" />
            </button>
          </div>
        </div>

        {/* Back to landing */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link
            href="/"
            style={{ fontSize: 13, color: "#94A3B8", textDecoration: "none", fontWeight: 500 }}
          >
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
