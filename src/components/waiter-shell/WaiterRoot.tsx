"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import AccessDenied from "@/components/staff/AccessDenied";
import Loader from "@/components/ui/Loader";
import WaiterBottomNav from "@/components/waiter-shell/WaiterBottomNav";
import WaiterTopBar from "@/components/waiter-shell/WaiterTopBar";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useCssHeightVar } from "@/hooks/useCssHeightVar";

export default function WaiterRoot({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <WaiterGate>{children}</WaiterGate>
    </AuthSessionProvider>
  );
}

function WaiterGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Oturum okunurken kilit ekranı çizilirse yetkili garson her yenilemede "Erişim Engellendi" görür
  if (status === "loading") return <Loader fullScreen label="Panel yükleniyor" />;
  const role = session?.user.role;
  if (role !== "WAITER" && role !== "ADMIN") return <AccessDenied message="Garson veya admin yetkisi gerekli." />;

  return (
    <NotificationSoundProvider mode="waiter">
      <WaiterShell>{children}</WaiterShell>
    </NotificationSoundProvider>
  );
}

function WaiterShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { counts } = useBadgeCounts();
  // Alt menü yüksekliği (güvenli alan payı dahil): içerik onun altında kalmasın
  const navRef = useCssHeightVar("--waiter-nav-h");

  return (
    <div className="min-h-viewport bg-surface-page pb-[var(--waiter-nav-h,72px)]" data-height-vars>
      <WaiterTopBar userName={session?.user.name} businessName={session?.user.businessName} />
      <main id="main-content" key={pathname} className="page-enter px-3.5 py-4">
        {children}
      </main>
      <WaiterBottomNav counts={counts} navRef={navRef} />
    </div>
  );
}
