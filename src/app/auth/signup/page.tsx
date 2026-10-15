"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 } as const;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planCode = searchParams.get("plan");

  const [formData, setFormData] = useState({
    businessName: "",
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, planCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Kayıt sırasında bir hata oluştu");
        setLoading(false);
        return;
      }

      // Hesap açıldı — doğrudan admin paneline giriş yap
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      router.push(result?.ok ? "/admin" : "/auth/signin?registered=true");
    } catch {
      setError("Kayıt yapılırken bir hata oluştu");
      setLoading(false);
    }
  };

  return (
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
        <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, wordBreak: "break-word" }}>
          İşletmenizi <span style={{ color: "var(--primary)" }}>Ücretsiz</span> Başlatın
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
          14 gün ücretsiz deneyin. Kredi kartı gerekmez.
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
          <label style={labelStyle}>İşletme Adı *</label>
          <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
            className="input" placeholder="Lezzet Kafe" required minLength={2} />
        </div>

        <div>
          <label style={labelStyle}>Ad Soyad *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="input" placeholder="Ahmet Yılmaz" required minLength={2} />
        </div>

        <div>
          <label style={labelStyle}>E-posta *</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange}
            className="input" placeholder="ornek@email.com" required />
        </div>

        <div>
          <label style={labelStyle}>Şifre *</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange}
            className="input" placeholder="En az 12 karakter, harf ve rakam" required minLength={12} maxLength={72} />
        </div>

        <div>
          <label style={labelStyle}>Telefon</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
            className="input" placeholder="+90 555 000 0000" />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg"
          style={{ width: "100%", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Hesap oluşturuluyor..." : "Ücretsiz Denemeyi Başlat"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Zaten hesabınız var mı?{" "}
          <Link href="/auth/signin" style={{ color: "var(--primary-light)", fontWeight: 600, textDecoration: "none" }}>
            Giriş Yap
          </Link>
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
          Garson musunuz?{" "}
          <Link href="/auth/register" style={{ color: "var(--primary-light)", fontWeight: 600, textDecoration: "none" }}>
            Davet koduyla kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
