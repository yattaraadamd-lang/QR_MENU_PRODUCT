"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const loadConfirmDialog = () => import("./ConfirmDialog");
// Pencere (Dialog + ikonlar) ilk yük paketinin dışında; bağlanınca arka planda önceden yüklenir
const ConfirmDialog = lazy(loadConfirmDialog);

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
}

/**
 * window.confirm yerine temalı, erişilebilir onay penceresi.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Silinsin mi?" }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  // İlk onayda chunk beklenmesin: ekran açılınca indirilir (aynı import, webpack tek istek atar)
  useEffect(() => {
    void loadConfirmDialog();
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    // Önceki pencere yanıtsız kaldıysa vazgeçilmiş say
    resolveRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOptions(null);
  };

  const confirmDialog = options && (
    <Suspense fallback={null}>
      <ConfirmDialog
        open
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </Suspense>
  );

  return [confirm, confirmDialog] as const;
}
