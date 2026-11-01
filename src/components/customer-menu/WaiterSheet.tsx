"use client";

import { useId, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import FormError from "@/components/ui/FormError";
import SheetHeader from "./SheetHeader";
import { WAITER_REASONS } from "./constants";
import styles from "./customer-menu.module.css";

type Props = {
  /** Çağrı gönderilemediyse pencerenin içinde gösterilir (toast modalın arkasında kalırdı) */
  error: string | null;
  onClose: () => void;
  /** Seçilen neden ya da "Diğer" için yazılan açıklama */
  onSubmit: (reason: string) => void;
  sending: boolean;
};

const OTHER_REASON = "Diğer";

/** Garson çağırma: nedenler gerçek bir radyo grubu (ok tuşlarıyla gezilir, seçim okunur) */
export default function WaiterSheet({ error, onClose, onSubmit, sending }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noteId = useId();
  const isOther = reason === OTHER_REASON;
  const canSubmit = !!reason && (!isOther || !!note.trim()) && !sending;

  const handleSubmit = () => onSubmit(isOther ? note.trim() : reason);

  return (
    <Dialog onClose={onClose} overlayStyle={{ alignItems: "flex-end" }} contentClassName={`modal-content modal-sheet ${styles.sheet}`}>
      <SheetHeader title="Garson çağır" onClose={onClose} />
      <div className={styles.sheetBody}>
        <fieldset className="reason-group">
          <legend className={styles.legend}>Garsonun size daha hızlı yardımcı olabilmesi için nedeninizi seçin:</legend>
          {WAITER_REASONS.map((r) => (
            <label key={r} className="reason-option">
              <input type="radio" name="waiter-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
              {r}
            </label>
          ))}
        </fieldset>
        {isOther && (
          <>
            <label htmlFor={noteId} className="sr-only">Açıklama</label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Açıklama yazın"
              maxLength={200}
              className={`input ${styles.note}`}
              style={{ marginBottom: 14 }}
            />
          </>
        )}
        <FormError message={error} style={{ marginBottom: 14 }} />
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={`btn btn-primary ${styles.submit}`}>
          {sending ? "Gönderiliyor…" : "Garson çağır"}
        </button>
      </div>
    </Dialog>
  );
}
