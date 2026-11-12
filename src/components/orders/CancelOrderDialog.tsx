"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { eyebrowClass } from "@/components/ui/tone";
import { CANCEL_NOTE_MAX, CANCEL_REASONS, type OrderProduct } from "./cancelOrder";
import type { OrderDTO } from "./types";
import { useCancelOrderForm, type CancelAction } from "./useCancelOrderForm";

interface CancelOrderDialogProps {
  order: OrderDTO;
  /** "Siparişi Reddet" / "Siparişi İptal Et" — başlık ve düğme */
  title: string;
  action: CancelAction;
  onClose: () => void;
  onDone: () => void;
  /** Neden listesinin üstünde (ör. admin için masa/tutar/durum özeti) */
  summary?: ReactNode;
}

/** Siparişi reddet/iptal et: neden, stokta olmayan ürünler, açıklama. Garson ve admin ortak. */
export default function CancelOrderDialog({ order, title, action, onClose, onDone, summary }: CancelOrderDialogProps) {
  const form = useCancelOrderForm({ order, action, onDone });
  const formId = useId();
  const isOther = form.values.reason === "OTHER";
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
        {summary}

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

        <Field label={isOther ? "Açıklama *" : "Açıklama (Opsiyonel)"} htmlFor={`${formId}-note`}>
          <textarea
            id={`${formId}-note`}
            className="input min-h-[4.5rem] resize-none"
            value={form.values.note}
            onChange={(e) => form.setNote(e.target.value)}
            placeholder="İptal/red nedenini detaylandırın..."
            maxLength={CANCEL_NOTE_MAX}
            required={isOther}
          />
        </Field>

        <FormError message={form.error} />
        <Alert tone="danger" size="sm">
          ⚠️ Bu işlem geri alınamaz.
        </Alert>
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
