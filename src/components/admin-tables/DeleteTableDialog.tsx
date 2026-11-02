"use client";

import { useApiMutation } from "@/hooks/useApiMutation";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { tableDisplayName } from "@/components/tables/tableModel";
import type { TableDTO } from "@/components/tables/types";
import { adminTablesApi } from "./adminTables.api";

interface DeleteTableDialogProps {
  table: TableDTO;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteTableDialog({ table, onClose, onDeleted }: DeleteTableDialogProps) {
  const remove = useApiMutation(adminTablesApi.remove);
  const name = tableDisplayName(table);

  const handleDelete = async () => {
    const result = await remove.run(table.id);
    if (result.ok) onDeleted();
  };

  return (
    <Modal
      onClose={onClose}
      title="🗑️ Masayı Sil"
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button variant="danger" className="flex-1" loading={remove.pending} onClick={handleDelete}>
            {remove.pending ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-secondary">
          <strong className="text-fg">&quot;{name}&quot;</strong> adlı masayı silmek üzeresiniz.
        </p>
        <Alert tone="danger">⚠️ Aktif sipariş, talep veya ödeme varsa silme engellenecektir.</Alert>
        <FormError message={remove.error} />
      </div>
    </Modal>
  );
}
