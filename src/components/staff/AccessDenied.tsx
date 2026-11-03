"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Button from "@/components/ui/Button";

/** Yetkisiz rol: kilit ekranı + giriş (admin, garson, süper admin kabukları) */
export default function AccessDenied({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="min-h-viewport flex items-center justify-center">
      <div className="p-8 text-center">
        <Lock aria-hidden="true" className="mx-auto mb-4 size-11 text-primary" />
        <h1 className="page-title mb-2">Erişim engellendi</h1>
        <p className="mb-6 text-fg-secondary">{message}</p>
        <Button onClick={() => router.push("/auth/signin")}>Giriş Yap</Button>
      </div>
    </div>
  );
}
