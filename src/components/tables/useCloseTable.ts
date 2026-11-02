"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { ApiResult } from "@/lib/api-client";
import { tablesApi } from "./tables.api";
import type { ForceCloseReason } from "./tableModel";
import type { TableDTO } from "./types";

type CloseRequest =
  | { readonly kind: "normal"; readonly sessionId: string }
  | { readonly kind: "force"; readonly tableId: string; readonly reason: ForceCloseReason };

function closeTable(request: CloseRequest): Promise<ApiResult<unknown>> {
  return request.kind === "force"
    ? tablesApi.forceClose(request.tableId, request.reason)
    : tablesApi.closeSession(request.sessionId);
}

function buildCloseRequest(table: TableDTO, forceMode: boolean, reason: ForceCloseReason | null): CloseRequest | null {
  if (forceMode) return reason ? { kind: "force", tableId: table.id, reason } : null;
  return table.activeSession ? { kind: "normal", sessionId: table.activeSession.id } : null;
}

interface Options {
  readonly table: TableDTO;
  /** Admin: tamamlanmamış sipariş varken nedenle zorla kapatabilir */
  readonly allowForce: boolean;
  readonly onClosed: () => void;
}

/** Masa kapatma: önce normal kapatma; sunucu izin verirse (canForceClose) zorla kapatmaya geçer. */
export function useCloseTable({ table, allowForce, onClosed }: Options) {
  const [forceMode, setForceMode] = useState(false);
  const [reason, setReason] = useState<ForceCloseReason | null>(null);
  const mutation = useApiMutation(closeTable);

  const enableForce = () => {
    if (allowForce) setForceMode(true);
  };

  const submit = async () => {
    const request = buildCloseRequest(table, forceMode, reason);
    if (!request) return;

    const result = await mutation.run(request);
    if (result.ok) {
      onClosed();
      return;
    }
    if (allowForce && result.body?.canForceClose === true) setForceMode(true);
  };

  return {
    forceMode,
    canOfferForce: allowForce && !forceMode && mutation.error !== null,
    enableForce,
    reason,
    setReason,
    canSubmit: !mutation.pending && (!forceMode || reason !== null),
    pending: mutation.pending,
    error: mutation.error,
    submit,
  };
}
