"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";
import { NotificationPanel } from "@/components/notifications";
import Button from "@/components/ui/Button";

/** Garson üst çubuğu (banner landmark'ı): marka, ad, işletme, bildirimler, çıkış */
export default function WaiterTopBar({ userName, businessName }: { userName?: string | null; businessName?: string | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface-muted px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandMark size={34} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight text-fg">{userName || "Garson"}</p>
          <p className="truncate text-2xs leading-tight text-fg-secondary">{businessName}</p>
        </div>
      </div>
      {/* Dar ekranda sıkışan taraf ad/işletme (kırpılır): düğmeler boyutunu korur */}
      <div className="flex shrink-0 items-center gap-2">
        <NotificationPanel />
        <Button
          variant="ghost"
          size="icon"
          title="Çıkış Yap"
          aria-label="Çıkış Yap"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          <LogOut aria-hidden="true" className="size-[18px]" />
        </Button>
      </div>
    </header>
  );
}
