"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { reportClientError } from "@/lib/report-error";
import { getCurrentUser } from "./auth.api";

export type DemoRole = "admin" | "waiter";

export interface DemoAccount {
  readonly role: DemoRole;
  readonly label: string;
  readonly email: string;
  readonly password: string;
}

/** Seed'deki herkese açık demo hesapları (prisma/demo-data.ts) */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { role: "admin", label: "Yönetici", email: "admin@demo.com", password: "admin123" },
  { role: "waiter", label: "Garson", email: "garson@demo.com", password: "garson123" },
];

const ROLE_HOME: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin",
};
const STAFF_HOME = "/waiter";
const FALLBACK_HOME = "/admin";

const WRONG_CREDENTIALS = "E-posta veya şifre hatalı. Bilgilerinizi kontrol edip tekrar deneyin.";
const UNEXPECTED_ERROR = "Giriş yapılırken bir sorun oluştu. Tekrar deneyin.";

async function resolveHome(): Promise<string> {
  const result = await getCurrentUser();
  if (!result.ok) return FALLBACK_HOME;
  const role = result.data?.user?.role;
  return (role && ROLE_HOME[role]) || STAFF_HOME;
}

/** Giriş formunun durumu ve davranışı; bileşen yalnız arayüzü çizer */
export function useSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Landing'deki demo kapılarından gelince alanları doldur. useSearchParams değil: o, statik
  // sayfayı Suspense sınırına kadar istemcide çizdiriyordu (form JS'yi bekliyordu).
  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("demo");
    const account = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (!account) return;
    setEmail(account.email);
    setPassword(account.password);
  }, []);

  const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const onPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

  const fillDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(WRONG_CREDENTIALS);
        return;
      }
      router.push(await resolveHome());
      router.refresh();
    } catch (err) {
      reportClientError("auth.signin", err);
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return { email, password, error, loading, onEmailChange, onPasswordChange, fillDemo, submit };
}
