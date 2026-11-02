"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { ApiResult } from "@/lib/api-client";
import { orderProducts, toCancelPayload, validateCancel, type CancelFormValues } from "./cancelOrder";
import type { CancelPayload, CancelReasonCode, OrderDTO } from "./types";

export type CancelAction = (orderId: string, payload: CancelPayload) => Promise<ApiResult<unknown>>;

interface Options {
  readonly order: OrderDTO;
  /** Modül düzeyinde servis fonksiyonu (kimliği sabit kalmalı) */
  readonly action: CancelAction;
  readonly onDone: () => void;
}

/** Red/iptal formu: neden, stokta olmayan ürünler, açıklama ve gönderim */
export function useCancelOrderForm({ order, action, onDone }: Options) {
  const [values, setValues] = useState<CancelFormValues>({ reason: null, note: "", outOfStockIds: [] });
  const mutation = useApiMutation(action);
  const products = orderProducts(order);

  // "Stokta yok" seçilince tek ürünlü siparişte ürün kendiliğinden işaretlenir
  const setReason = (reason: CancelReasonCode) =>
    setValues((prev) => ({
      ...prev,
      reason,
      outOfStockIds: reason === "OUT_OF_STOCK" && products.length === 1 ? [products[0].id] : [],
    }));

  const toggleProduct = (id: string) =>
    setValues((prev) => ({
      ...prev,
      outOfStockIds: prev.outOfStockIds.includes(id)
        ? prev.outOfStockIds.filter((p) => p !== id)
        : [...prev.outOfStockIds, id],
    }));

  const setNote = (note: string) => setValues((prev) => ({ ...prev, note }));

  const submit = async () => {
    const error = validateCancel(values);
    const reason = values.reason;
    if (error || !reason) {
      mutation.setError(error);
      return;
    }
    const result = await mutation.run(order.id, toCancelPayload({ ...values, reason }));
    if (result.ok) onDone();
  };

  return { values, products, setReason, toggleProduct, setNote, pending: mutation.pending, error: mutation.error, submit };
}
