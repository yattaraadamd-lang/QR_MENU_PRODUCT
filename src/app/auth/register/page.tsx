"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Kayıt sırasında bir hata oluştu");
        setLoading(false);
        return;
      }

      router.push("/auth/signin?registered=true");
    } catch (err) {
      setError("Kayıt yapılırken bir hata oluştu");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        maxWidth: 420,
        width: "100%",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 20,
        padding: "28px 24px",
        overflow: "hidden",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👨‍🍳</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, wordBreak: "break-word" }}>
            <span style={{ color: "var(--primary)" }}>Garson</span> Kayıt
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
            Davet kodunuzla garson hesabı oluşturun
          </p>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10,
            color: "#f87171",
            fontSize: 13,
            marginBottom: 16,
            wordBreak: "break-word",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Ad Soyad *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="Ahmet Yılmaz"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              E-posta *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Şifre *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Telefon
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input"
              placeholder="+90 555 000 0000"
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Davet Kodu *
            </label>
            <input
              type="text"
              name="inviteCode"
              value={formData.inviteCode}
              onChange={handleChange}
              className="input"
              placeholder="DEMO2024"
              required
              style={{ textTransform: "uppercase" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              İşletme yöneticinizden aldığınız davet kodunu girin
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Zaten hesabınız var mı?{" "}
            <Link href="/auth/signin" style={{ color: "var(--primary-light)", fontWeight: 600, textDecoration: "none" }}>
              Giriş Yap
            </Link>
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            ← Ana Sayfaya Dön
          </Link>
        </div>

        <div style={{
          marginTop: 16,
          padding: 12,
          background: "rgba(99,102,241,0.05)",
          borderRadius: 10,
          border: "1px solid rgba(99,102,241,0.1)",
        }}>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
            <strong>Demo için davet kodu:</strong> DEMO2024
          </p>
        </div>
      </div>
    </div>
  );
}
