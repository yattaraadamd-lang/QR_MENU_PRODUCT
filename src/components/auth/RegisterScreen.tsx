"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { AuthCard, AuthHeader, AuthLinks, BackHomeLink, FormAlert, NEW_PASSWORD_PROPS, PERSON_NAME_PROPS, authStyles as styles } from "@/components/auth/AuthParts";
import { STAFF_ASIDE } from "@/components/auth/asides";
import { registerStaff } from "./auth.api";

export default function RegisterScreen() {
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

    const result = await registerStaff(formData);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/auth/signin?registered=true");
  };

  return (
    <AuthShell aside={STAFF_ASIDE}>
      <AuthHeader
        eyebrow="Garson kaydı"
        title={
          <>
            Ekibe <em>katılın.</em>
          </>
        }
        desc="Davet kodunuz veya linkinizle garson hesabınızı oluşturun."
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

          <div>
            <label htmlFor="f-davet-kodu-veya-linki" className={styles.label}>Davet kodu veya linki *</label>
            <input id="f-davet-kodu-veya-linki" type="text" name="inviteCode" value={formData.inviteCode}
              onChange={handleChange} className="input" placeholder="inv_… ya da davet linkinin tamamı" required
              autoComplete="off" aria-describedby="f-davet-ipucu" />
            <p id="f-davet-ipucu" className={styles.hint}>
              Yöneticinizden gelen davet linkini açarsanız bu adıma gerek kalmaz. Linki buraya da yapıştırabilirsiniz.
            </p>
          </div>

          <button type="submit" disabled={loading} className={`btn btn-primary btn-lg ${styles.submit}`}>
            {loading ? "Kayıt yapılıyor…" : "Kayıt ol"}
          </button>
        </form>

        <AuthLinks>
          <p>
            Zaten hesabınız var mı? <Link href="/auth/signin">Giriş yapın</Link>
          </p>
        </AuthLinks>
      </AuthCard>
      <BackHomeLink />
    </AuthShell>
  );
}