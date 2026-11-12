"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { AuthCard, AuthHeader, BackHomeLink, FormAlert, NEW_PASSWORD_PROPS, PERSON_NAME_PROPS, authStyles as styles } from "@/components/auth/AuthParts";
import { STAFF_ASIDE } from "@/components/auth/asides";
import { registerStaff, verifyInvite, type InviteInvalidReason } from "./auth.api";

type InviteState =
  | { status: "loading" }
  | { status: "valid"; businessName: string; expiresAt: string }
  | { status: "invalid"; reason: InviteInvalidReason };

const INVALID_MESSAGES: Readonly<Record<InviteInvalidReason, string>> = {
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
    // verifyInvite reddetmez: ağ hatası ve okunamayan yanıt "ERROR" nedeniyle döner
    void verifyInvite(code).then((check) => {
      if (cancelled) return;
      setInvite(
        check.valid
          ? { status: "valid", businessName: check.businessName, expiresAt: check.expiresAt }
          : { status: "invalid", reason: check.reason },
      );
    });
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
    const registration = await registerStaff({ ...formData, phone: formData.phone || null, inviteCode: code });
    if (!registration.ok) {
      setError(registration.error);
      setSubmitting(false);
      return;
    }
    try {
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
                  className="input" placeholder="Ahmet Yılmaz" {...PERSON_NAME_PROPS} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="f-e-posta" className={styles.label}>E-posta *</label>
                <input id="f-e-posta" type="email" name="email" value={formData.email} onChange={handleChange}
                  className="input" placeholder="ornek@email.com" required autoComplete="email" />
              </div>
              <div>
                <label htmlFor="f-sifre" className={styles.label}>Şifre *</label>
                <input id="f-sifre" type="password" name="password" value={formData.password} onChange={handleChange}
                  className="input" {...NEW_PASSWORD_PROPS}
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