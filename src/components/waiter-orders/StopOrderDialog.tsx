"use client";

import { useId, type FormEvent } from "react";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { eyebrowClass } from "@/components/ui/tone";
import { cn } from "@/lib/cn";
import { CANCEL_REASONS, type OrderProduct } from "./orderModel";
import type { OrderDTO } from "./types";
import { useStopOrderForm } from "./useStopOrderForm";

interface StopOrderDialogProps {
  order: OrderDTO;
  /** Bekleyen sipariş reddedilir, kabul edilmiş olan iptal edilir */
  target: "REJECTED" | "CANCELLED";
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function StopOrderDialog({ order, target, onClose, onDone }: StopOrderDialogProps) {
  const form = useStopOrderForm({ order, target, onDone });
  const formId = useId();
  const title = target === "REJECTED" ? "Siparişi Reddet" : "Siparişi İptal Et";
  // İstek sürerken pencere kapanmaz: sonuç kaybolmasın
  const close = () => !form.pending && onClose();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.submit();
  };

  return (
    <Modal
      onClose={close}
      title={`⚠️ ${title}`}
      description={`${tableDisplayName(order.table)} — neden seçin`}
      footer={
        <>
          <Button type="submit" form={formId} variant="danger" className="flex-1" loading={form.pending}>
            {form.pending ? "İşleniyor..." : title}
          </Button>
          <Button variant="ghost" disabled={form.pending} onClick={close}>
            Vazgeç
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <ChoiceGroup
          legend="Neden *"
          layout="stack"
          options={CANCEL_REASONS}
          value={form.values.reason}
          onChange={form.setReason}
        />

        {form.values.reason === "OUT_OF_STOCK" && (
          <OutOfStockPicker products={form.products} selected={form.values.outOfStockIds} onToggle={form.toggleProduct} />
        )}

        {form.values.reason === "OTHER" && (
          <Field label="Açıklama *" htmlFor={`${formId}-note`}>
            <textarea
              id={`${formId}-note`}
              className="input min-h-[4.5rem] resize-none"
              value={form.values.note}
              onChange={(e) => form.setNote(e.target.value)}
              placeholder="İptal/red nedenini detaylandırın..."
              maxLength={500}
              required
            />
          </Field>
        )}

        <FormError message={form.error} />
      </form>
    </Modal>
  );
}

interface OutOfStockPickerProps {
  products: readonly OrderProduct[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}

/** Stokta olmayan ürünleri işaretleme (fieldset + onay kutuları) */
function OutOfStockPicker({ products, selected, onToggle }: OutOfStockPickerProps) {
  return (
    <Alert tone="warning" size="sm">
      <fieldset>
        <legend className={cn("mb-2", eyebrowClass)}>Stokta olmayan ürünü/ürünleri seçin</legend>
        {products.length === 0 && (
          <p className="text-sm text-fg">Bu siparişin ürün bilgisi alınamadı; başka bir neden seçin.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {products.map((product) => (
            <label key={product.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                className="size-4 accent-danger"
                checked={selected.includes(product.id)}
                onChange={() => onToggle(product.id)}
              />
              {product.name}
            </label>
          ))}
        </div>
        <p className="mt-2 font-semibold text-danger-fg">
          ⚠️ Seçilen ürünler stokta yok olarak işaretlenecek ve müşteriler sipariş veremeyecektir.
        </p>
      </fieldset>
    </Alert>
  );
}
