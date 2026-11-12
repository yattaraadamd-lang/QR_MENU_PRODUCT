"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { SIGNUP_BUSINESS_NAME_LIMITS } from "@/contracts/business";
import AuthShell from "@/components/auth/AuthShell";
import { AuthCard, AuthHeader, AuthLinks, BackHomeLink, FormAlert, NEW_PASSWORD_PROPS, PERSON_NAME_PROPS, authStyles as styles } from "@/components/auth/AuthParts";
import { SIGNUP_ASIDE } from "@/components/auth/asides";
import { signupBusiness } from "./auth.api";

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

    const signup = await signupBusiness({ ...formData, planCode });
    if (!signup.ok) {
      setError(signup.error);
      setLoading(false);
      return;
    }

    try {
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
    <>
      <AuthHeader
        eyebrow="14 gün ücretsiz"
        title={
          <>
            İşletmenizi <em>başlatın.</em>
          </>
        }
        desc="Kredi kartı gerekmez. Hesabınız açılınca doğrudan panele geçersiniz."
      />
      <AuthCard>
        {error && <FormAlert>{error}</FormAlert>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="f-isletme-adi" className={styles.label}>İşletme adı *</label>
            <input id="f-isletme-adi" type="text" name="businessName" value={formData.businessName} onChange={handleChange}
              className="input" placeholder="Lezzet Kafe" required minLength={SIGNUP_BUSINESS_NAME_LIMITS.min}
              maxLength={SIGNUP_BUSINESS_NAME_LIMITS.max} autoComplete="organization" />
          </div>

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

          <button type="submit" disabled={loading} className={`btn btn-primary btn-lg ${styles.submit}`}>
            {loading ? "Hesap oluşturuluyor…" : "Ücretsiz denemeyi başlat"}
          </button>
        </form>

        <AuthLinks>
          <p>
            Zaten hesabınız var mı? <Link href="/auth/signin">Giriş yapın</Link>
          </p>
          <p>
            Garson musunuz? <Link href="/auth/register">Davet koduyla kayıt olun</Link>
          </p>
        </AuthLinks>
      </AuthCard>
    </>
  );
}

export default function SignupScreen() {
  return (
    <AuthShell aside={SIGNUP_ASIDE}>
      <Suspense>
        <SignupForm />
      </Suspense>
      <BackHomeLink />
    </AuthShell>
  );
}