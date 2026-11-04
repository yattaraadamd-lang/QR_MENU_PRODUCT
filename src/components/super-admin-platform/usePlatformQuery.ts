"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";

/** Süper admin listeleri: oturum doğrulanmadan istek atılmaz. `select` modül düzeyinde olmalı */
export function usePlatformQuery<T>(url: string, select: (json: unknown) => T) {
  const { data: session } = useSession();
  return useApiQuery(session?.user.role === "SUPER_ADMIN" ? url : null, { select });
}
