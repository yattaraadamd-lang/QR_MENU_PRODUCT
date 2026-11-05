"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Button from "@/components/ui/Button";

/** Yetkisiz rol ya da sona eren oturum: kilit ekranı + giriş (admin, garson, süper admin kabukları) */
export default function AccessDenied({ message }: { message: string }) {
  const router = useRouter();
  const { status } = useSession();
  // Oturum iptal edildi ya da süresi doldu: sorun yetki değil, yeniden giriş yetiyor
  const expired = status === "unauthenticated";

  return (
    <div className="min-h-viewport flex items-center justify-center">
      <div className="p-8 text-center">
        <Lock aria-hidden="true" className="mx-auto mb-4 size-11 text-primary" />
        <h1 className="page-title mb-2">{expired ? "Oturumunuz sona erdi" : "Erişim engellendi"}</h1>
        <p className="mb-6 text-fg-secondary">{expired ? "Devam etmek için yeniden giriş yapın." : message}</p>
        <Button onClick={() => router.push("/auth/signin")}>Giriş Yap</Button>
      </div>
    </div>
  );
}
