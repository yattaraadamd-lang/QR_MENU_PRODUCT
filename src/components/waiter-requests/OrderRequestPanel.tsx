"use client";

import { useId, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import CodeInput from "@/components/ui/CodeInput";
import Field from "@/components/ui/Field";
import { VERIFICATION_CODE_LENGTH } from "@/components/requests/requestModel";
import type { ServiceRequestDTO } from "@/components/requests/types";

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
