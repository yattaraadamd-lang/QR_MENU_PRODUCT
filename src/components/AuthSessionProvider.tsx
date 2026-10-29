"use client";

import { SessionProvider } from "next-auth/react";

// Yalnız personel panelleri ve giriş/kayıt sayfaları: müşteri menüsü, QR ve landing
// next-auth kullanmaz; /api/auth/session isteği ve paketi oralara gitmesin
export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
