"use client";

import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

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

  const confirmDialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description}
      confirmText={options?.confirmText}
      cancelText={options?.cancelText}
      variant={options?.variant}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return [confirm, confirmDialog] as const;
}
