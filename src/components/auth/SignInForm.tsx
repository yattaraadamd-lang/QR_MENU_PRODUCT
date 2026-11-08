"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import Input from "@/components/ui/Input";
import { enterDelay } from "@/components/ui/motion-style";
import { AuthCard, AuthLinks, FormAlert, authStyles as styles } from "./AuthParts";
import { DEMO_ACCOUNTS, useSignIn } from "./useSignIn";

export default function SignInForm() {
  const { email, password, error, loading, onEmailChange, onPasswordChange, fillDemo, submit } = useSignIn();

  return (
    <>
      <AuthCard>
        {error && <FormAlert>{error}</FormAlert>}

        <form onSubmit={submit} className={styles.form}>
          <Input
            label="E-posta adresi"
            type="email"
            value={email}
            onChange={onEmailChange}
            placeholder="ornek@isletme.com"
            required
            autoComplete="email"
            leftIcon={<Mail size={18} aria-hidden="true" />}
            large
          />
          <Input
            label="Şifre"
            value={password}
            onChange={onPasswordChange}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            showPasswordToggle
            leftIcon={<Lock size={18} aria-hidden="true" />}
            large
          />
          <button type="submit" disabled={loading} className={`btn btn-primary btn-lg ${styles.submit}`}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Giriş yapılıyor…
              </>
            ) : (
              <>
                Giriş yap <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <AuthLinks>
          <p>
            İşletmeniz için hesap mı açacaksınız? <Link href="/auth/signup">Ücretsiz deneyin</Link>
          </p>
          <p>
            Garson hesabınız yok mu? <Link href="/auth/register">Kayıt olun</Link>
          </p>
        </AuthLinks>
      </AuthCard>

      <section aria-labelledby="demo-accounts" className={`enter-rise ${styles.demo}`} style={enterDelay(0.2)}>
        <h2 id="demo-accounts" className="eyebrow">
          Demo hesapları
        </h2>
        <div className={styles.demoGrid}>
          {DEMO_ACCOUNTS.map((account) => (
            <button key={account.role} type="button" onClick={() => fillDemo(account)} className={styles.demoButton}>
              <span>
                <strong>{account.label}</strong>
                <span>{account.email}</span>
              </span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
