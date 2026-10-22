"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type InviteState =
  | { status: "loading" }
  | { status: "valid"; businessName: string; expiresAt: string }
  | { status: "invalid"; reason: "INVALID" | "USED" | "EXPIRED" | "ERROR" };

const INVALID_MESSAGES: Record<string, string> = {
  USED: "Bu davet linki daha önce kullanılmış.",
  EXPIRED: "Bu davet linkinin süresi dolmuş.",
  INVALID: "Bu davet linki geçersiz.",
  ERROR: "Davet doğrulanamadı. Lütfen biraz sonra tekrar deneyin.",
};

const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 } as const;

export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");

  const [invite, setInvite] = useState<InviteState>({ status: "loading" });
  const [formData, setFormData] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/invite/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (cancelled) return;
        setInvite(
          data.valid
            ? { status: "valid", businessName: data.businessName, expiresAt: data.expiresAt }
            : { status: "invalid", reason: data.reason ?? "INVALID" }
        );
      } catch {
        if (!cancelled) setInvite({ status: "invalid", reason: "ERROR" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, phone: formData.phone || null, inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kayıt sırasında bir hata oluştu");
        setSubmitting(false);
        return;
      }

      // Hesap açıldı — doğrudan garson paneline giriş
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      router.push(result?.ok ? "/waiter" : "/auth/signin?registered=true");
    } catch {
      setError("Kayıt yapılırken bir hata oluştu");
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(700px 400px at 85% -10%, rgba(217,68,31,0.28), transparent 70%), linear-gradient(135deg, #17110E 0%, #2A1A12 50%, #17110E 100%)",
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
        {invite.status === "loading" && (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>Davet kontrol ediliyor...</p>
        )}

        {invite.status === "invalid" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{INVALID_MESSAGES[invite.reason]}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              İşletme yöneticinizden yeni bir davet linki isteyin.
            </p>
            <Link href="/auth/signin" className="btn btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>
              Giriş sayfasına git
            </Link>
          </div>
        )}

        {invite.status === "valid" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>👨‍🍳</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, wordBreak: "break-word" }}>
                <span style={{ color: "var(--primary)" }}>{invite.businessName}</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
                sizi garson olarak ekibine davet ediyor. Hesabınızı oluşturun.
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
                <label htmlFor="f-ad-soyad" style={labelStyle}>Ad Soyad *</label>
                <input id="f-ad-soyad" type="text" name="name" value={formData.name} onChange={handleChange}
                  className="input" placeholder="Ahmet Yılmaz" required minLength={2} />
              </div>
              <div>
                <label htmlFor="f-e-posta" style={labelStyle}>E-posta *</label>
                <input id="f-e-posta" type="email" name="email" value={formData.email} onChange={handleChange}
                  className="input" placeholder="ornek@email.com" required />
              </div>
              <div>
                <label htmlFor="f-sifre" style={labelStyle}>Şifre *</label>
                <input id="f-sifre" type="password" name="password" value={formData.password} onChange={handleChange}
                  className="input" placeholder="En az 12 karakter, harf ve rakam" required minLength={12} maxLength={72} />
              </div>
              <div>
                <label htmlFor="f-telefon" style={labelStyle}>Telefon</label>
                <input id="f-telefon" type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className="input" placeholder="+90 555 000 0000" />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-lg"
                style={{ width: "100%", marginTop: 4, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Hesap oluşturuluyor..." : "Katıl ve Başla"}
              </button>
            </form>

            <p style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 16 }}>
              Davet {new Date(invite.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli ve tek kullanımlıktır.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
