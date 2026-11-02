"use client";

import { useId, useState, type FormEvent } from "react";
import { formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import CodeInput from "@/components/ui/CodeInput";
import Field from "@/components/ui/Field";
import { VERIFICATION_CODE_LENGTH } from "./requestModel";
import type { OrderPreviewDTO, ServiceRequestDTO } from "./types";

/** Masa açma isteğinin sepet özeti */
export function OrderPreview({ preview }: { preview: OrderPreviewDTO }) {
  return (
    <Alert tone="warning" size="sm" className="mt-2">
      <p className="mb-1.5 font-bold text-fg">📋 Ürün Özeti</p>
      <ul className="flex flex-col gap-1 text-fg">
        {preview.items?.map((item, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              <strong>{item.quantity}×</strong> {item.name}
              {item.note && <span className="ml-1 text-fg-muted">({item.note})</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatTRY(Number(item.unitPrice || 0) * Number(item.quantity || 1))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex justify-between gap-2 border-t border-dashed border-warning/40 pt-1.5 text-sm font-extrabold text-fg">
        <span>Tahmini Toplam</span>
        <span className="tabular-nums text-primary-light">{formatTRY(preview.total ?? 0)}</span>
      </p>
      {preview.orderNote && <p className="mt-1 italic text-fg-secondary">Not: {preview.orderNote}</p>}
    </Alert>
  );
}

interface OrderRequestActionsProps {
  request: ServiceRequestDTO;
  busy: boolean;
  onOpen: (request: ServiceRequestDTO, code: string) => Promise<boolean>;
  onReject: (request: ServiceRequestDTO) => void;
}

/** Masa açma: müşterinin ekranındaki 6 haneli kodla "Masayı Aç" ya da "Reddet" (masa boş) */
export function OrderRequestActions({ request, busy, onOpen, onReject }: OrderRequestActionsProps) {
  const [code, setCode] = useState("");
  const id = useId();
  const complete = code.length === VERIFICATION_CODE_LENGTH;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complete) return;
    if (await onOpen(request, code)) setCode("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2.5 flex flex-col gap-2.5">
      <Field label="🔑 Müşteri Doğrulama Kodu (6 Haneli)" htmlFor={`${id}-code`}>
        <CodeInput id={`${id}-code`} value={code} onChange={setCode} length={VERIFICATION_CODE_LENGTH} placeholder="Örn: 482913" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="success" size="sm" className="flex-[2]" loading={busy} disabled={!complete}>
          {busy ? "Açılıyor..." : "🔓 Masayı Aç"}
        </Button>
        <Button variant="danger-ghost" size="sm" disabled={busy} onClick={() => onReject(request)}>
          🛑 Reddet
        </Button>
      </div>
    </form>
  );
}
