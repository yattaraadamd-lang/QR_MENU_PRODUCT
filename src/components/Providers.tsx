"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 14,
          },
        }}
      />
    </SessionProvider>
  );
}
