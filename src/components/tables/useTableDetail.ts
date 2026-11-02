"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tablesApi } from "./tables.api";
import type { BillDetailDTO, TableDTO } from "./types";

export type BillState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly bill: BillDetailDTO }
  | { readonly status: "error"; readonly error: string };

const IDLE: BillState = { status: "idle" };

/**
 * Seçili masa + adisyonu. Masa listeden id ile türetilir: polling yeni durum getirince
 * pencere de güncellenir, masa silinirse pencere kapanır. Yeni yükleme öncekini iptal eder.
 */
export function useTableDetail(tables: readonly TableDTO[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [billState, setBillState] = useState<BillState>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);

  const table = selectedId ? (tables.find((t) => t.id === selectedId) ?? null) : null;

  const loadBill = useCallback(async (sessionId: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBillState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));

    const result = await tablesApi.getBill(sessionId, controller.signal);
    if (controller.signal.aborted) return;
    setBillState(result.ok ? { status: "ready", bill: result.data } : { status: "error", error: result.error });
  }, []);

  const open = useCallback(
    (next: TableDTO) => {
      controllerRef.current?.abort();
      setSelectedId(next.id);
      setBillState(next.activeSession ? { status: "loading" } : IDLE);
      if (next.activeSession) void loadBill(next.activeSession.id);
    },
    [loadBill],
  );

  const close = useCallback(() => {
    controllerRef.current?.abort();
    setSelectedId(null);
    setBillState(IDLE);
  }, []);

  const sessionId = table?.activeSession?.id ?? null;
  const reloadBill = useCallback(() => {
    if (sessionId) void loadBill(sessionId);
  }, [loadBill, sessionId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { table, billState, open, close, reloadBill };
}
