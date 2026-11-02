"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { cancelReasonText, orderProducts, validateCancel, type CancelFormValues } from "./orderModel";
import type { CancelReasonCode, OrderDTO } from "./types";
import { waiterOrdersApi } from "./waiterOrders.api";

interface Options {
  readonly order: OrderDTO;
  readonly target: "REJECTED" | "CANCELLED";
  readonly onDone: (message: string) => void;
}

/** Sipariş reddetme/iptal formu: neden, stokta olmayan ürünler, açıklama ve gönderim */
export function useStopOrderForm({ order, target, onDone }: Options) {
  const [values, setValues] = useState<CancelFormValues>({ reason: null, note: "", outOfStockIds: [] });
  const mutation = useApiMutation(waiterOrdersApi.updateStatus);
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
    if (error || !values.reason) {
      mutation.setError(error);
      return;
    }
    const result = await mutation.run(order.id, {
      status: target,
      cancelReason: cancelReasonText(values),
      reasonCode: values.reason,
      outOfStockProductIds: values.reason === "OUT_OF_STOCK" ? values.outOfStockIds : null,
    });
    if (result.ok) onDone(target === "REJECTED" ? "Sipariş reddedildi" : "Sipariş iptal edildi");
  };

  return {
    values,
    products,
    setReason,
    toggleProduct,
    setNote,
    pending: mutation.pending,
    error: mutation.error,
    submit,
  };
}
