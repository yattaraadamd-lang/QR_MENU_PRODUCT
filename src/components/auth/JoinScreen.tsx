"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { AuthCard, AuthHeader, BackHomeLink, FormAlert, authStyles as styles } from "@/components/auth/AuthParts";
import { STAFF_ASIDE } from "@/components/auth/asides";

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

export default function JoinScreen() {
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
    <AuthShell aside={STAFF_ASIDE}>
      {invite.status === "loading" && (
        <p role="status" className={styles.status}>Davet kontrol ediliyor…</p>
      )}

      {invite.status === "invalid" && (
        <>
          <AuthHeader eyebrow="Davet" title={INVALID_MESSAGES[invite.reason]} desc="İşletme yöneticinizden yeni bir davet linki isteyin." />
          <p className={styles.center}>
            <Link href="/auth/signin" className="btn btn-primary">
              Giriş sayfasına git
            </Link>
          </p>
        </>
      )}

      {invite.status === "valid" && (
        <>
          <AuthHeader
            eyebrow="Ekip daveti"
            title={<em>{invite.businessName}</em>}
            desc="sizi garson olarak ekibine davet ediyor. Hesabınızı oluşturun."
          />
          <AuthCard>
            {error && <FormAlert>{error}</FormAlert>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div>
                <label htmlFor="f-ad-soyad" className={styles.label}>Ad soyad *</label>
                <input id="f-ad-soyad" type="text" name="name" value={formData.name} onChange={handleChange}
                  className="input" placeholder="Ahmet Yılmaz" required minLength={2} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="f-e-posta" className={styles.label}>E-posta *</label>
                <input id="f-e-posta" type="email" name="email" value={formData.email} onChange={handleChange}
                  className="input" placeholder="ornek@email.com" required autoComplete="email" />
              </div>
              <div>
                <label htmlFor="f-sifre" className={styles.label}>Şifre *</label>
                <input id="f-sifre" type="password" name="password" value={formData.password} onChange={handleChange}
                  className="input" placeholder="En az 12 karakter, harf ve rakam" required minLength={12} maxLength={72}
                  autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="f-telefon" className={styles.label}>Telefon</label>
                <input id="f-telefon" type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className="input" placeholder="+90 555 000 0000" autoComplete="tel" />
              </div>
              <button type="submit" disabled={submitting} className={`btn btn-primary btn-lg ${styles.submit}`}>
                {submitting ? "Hesap oluşturuluyor…" : "Katıl ve başla"}
              </button>
            </form>

            <p className={styles.hint}>
              Davet {new Date(invite.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli ve tek kullanımlıktır.
            </p>
          </AuthCard>
        </>
      )}
      <BackHomeLink />
    </AuthShell>
  );
}