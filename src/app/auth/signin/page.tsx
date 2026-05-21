"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
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
      setError("Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d1117 0%, #1a1040 50%, #0d1117 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      {/* Background decoration */}
      <div style={{
        position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
      }}>
        <div style={{
          position: "absolute", top: "20%", left: "10%", width: 400, height: 400,
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", right: "10%", width: 300, height: 300,
          background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
      </div>

      <div style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
          }}>
            🍽️
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#e6edf3", letterSpacing: "-0.02em" }}>
            QR Menü Platformu
          </h1>
          <p style={{ color: "#7d8590", fontSize: 14, marginTop: 6 }}>
            Hesabınıza giriş yapın
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}>
          {error && (
            <div style={{
              padding: "12px 16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10,
              color: "#fca5a5",
              fontSize: 13,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#7d8590", display: "block", marginBottom: 6 }}>
                E-posta adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="ornek@isletme.com"
                required
                autoComplete="email"
                style={{ fontSize: 15 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#7d8590", display: "block", marginBottom: 6 }}>
                Şifre
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ fontSize: 15, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#7d8590",
                    fontSize: 16, padding: 4,
                  }}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 4, fontSize: 15 }}
            >
              {loading ? (
                <><span className="animate-spin" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> Giriş yapılıyor...</>
              ) : "Giriş Yap →"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <p style={{ fontSize: 13, color: "#7d8590" }}>
              Garson hesabınız yok mu?{" "}
              <Link href="/auth/register" style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.15)",
          borderRadius: 12,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, color: "#7d8590" }}>
            <strong style={{ color: "#818cf8" }}>Demo:</strong>{" "}
            admin@demo.com / admin123 &nbsp;·&nbsp; garson@demo.com / garson123
          </p>
        </div>
      </div>
    </div>
  );
}
