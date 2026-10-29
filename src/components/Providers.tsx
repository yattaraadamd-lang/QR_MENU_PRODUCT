"use client";

import { Toaster } from "sonner";

// Oturum sağlayıcısı burada değil: yalnız personel ve auth layout'larında (AuthSessionProvider)
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        richColors
        // Canlı bölgenin ekran okuyucu adı (varsayılan İngilizce "Notifications")
        containerAriaLabel="Bildirimler"
        toastOptions={{
          style: {
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 14,
          },
        }}
      />
    </>
  );
}
