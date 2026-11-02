"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { formatDateTime } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { blockedDevicesApi } from "./blockedDevices.api";
import type { DeviceBlockDTO } from "./types";

const NOTE_MAX = 500;

interface UnblockDialogProps {
  block: DeviceBlockDTO;
  onClose: () => void;
  onUnblocked: () => void;
}

/** Cihaz engelini kaldır: engel özeti, etkisi ve isteğe bağlı not */
export default function UnblockDialog({ block, onClose, onUnblocked }: UnblockDialogProps) {
  const [note, setNote] = useState("");
  const revoke = useApiMutation(blockedDevicesApi.revoke);
  const formId = useId();
  const counterId = `${formId}-count`;
  // İstek sürerken pencere kapanmaz: sonuç kaybolmasın
  const close = () => !revoke.pending && onClose();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await revoke.run(block.id, note);
    if (result.ok) onUnblocked();
  };

  const rows = [
    { label: "Cihaz", value: <code className="font-mono text-xs">{block.maskedDeviceHash}</code> },
    { label: "Engel Nedeni", value: block.reason },
    { label: "Engel Tarihi", value: formatDateTime(block.createdAt) },
  ];

  return (
    <Modal
      onClose={close}
      title="Engeli Kaldır"
      footer={
        <>
          <Button variant="ghost" className="flex-1" disabled={revoke.pending} onClick={close}>
            İptal
          </Button>
          <Button type="submit" form={formId} className="flex-1" loading={revoke.pending}>
            {revoke.pending ? "İşleniyor..." : "Engeli Kaldır"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 rounded-md bg-surface-hover p-4 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt className="shrink-0 text-fg-secondary">{row.label}</dt>
              <dd className="min-w-0 break-words text-right font-semibold text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>

        <Alert tone="warning" size="sm">
          ⚠️ Bu işlem cihaz engelini kaldırır. Cihaz sahibi QR kodunu yeniden okuttuğunda yeni bir oturum açabilir.
          Eski oturumlar etkilenmez.
        </Alert>

        <Field label="Açıklama (isteğe bağlı)" htmlFor={`${formId}-note`}>
          <textarea
            id={`${formId}-note`}
            className="input resize-y"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Engel kaldırma nedenini belirtin..."
            maxLength={NOTE_MAX}
            aria-describedby={counterId}
          />
          <p id={counterId} className="mt-1 text-right text-2xs text-fg-muted">
            {note.length}/{NOTE_MAX}
          </p>
        </Field>

        <FormError message={revoke.error} />
      </form>
    </Modal>
  );
}
