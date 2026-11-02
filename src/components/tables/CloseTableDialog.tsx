"use client";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ChoiceGroup, { type ChoiceOption } from "@/components/ui/ChoiceGroup";
import Modal from "@/components/ui/Modal";
import { FORCE_CLOSE_REASONS, tableDisplayName, type ForceCloseReason } from "./tableModel";
import { useCloseTable } from "./useCloseTable";
import type { TableDTO } from "./types";

const REASON_OPTIONS: readonly ChoiceOption<ForceCloseReason>[] = FORCE_CLOSE_REASONS.map((reason) => ({
  value: reason,
  label: reason,
}));

interface CloseTableDialogProps {
  table: TableDTO;
  /** Admin: tamamlanmamış siparişte nedenle zorla kapatabilir; garson yalnız normal kapatır */
  allowForce: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export default function CloseTableDialog({ table, allowForce, onClose, onClosed }: CloseTableDialogProps) {
  const close = useCloseTable({ table, allowForce, onClosed });
  const submitLabel = close.forceMode ? "Zorla Kapat" : "Masayı Kapat";

  return (
    <Modal
      onClose={onClose}
      title="🔒 Masayı Kapat"
      description={tableDisplayName(table)}
      footer={
        <>
          <Button
            variant={close.forceMode ? "warning" : "danger"}
            className="flex-1"
            loading={close.pending}
            disabled={!close.canSubmit}
            onClick={close.submit}
          >
            {close.pending ? "Kapatılıyor..." : submitLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {close.error && (
          <Alert tone="danger" role="alert">
            <p>⚠️ {close.error}</p>
            {close.canOfferForce && (
              <button
                type="button"
                onClick={close.enableForce}
                className="mt-2 text-xs font-semibold text-warning-fg underline-offset-2 hover:underline"
              >
                Admin olarak zorla kapat →
              </button>
            )}
            {!allowForce && (
              <p className="mt-2 text-2xs text-fg-muted">
                Masada aktif sipariş varken kapatmak için admin yetkisi gereklidir.
              </p>
            )}
          </Alert>
        )}

        {close.forceMode && (
          <ChoiceGroup
            legend="Kapatma Nedeni *"
            layout="stack"
            options={REASON_OPTIONS}
            value={close.reason}
            onChange={close.setReason}
          />
        )}
      </div>
    </Modal>
  );
}
