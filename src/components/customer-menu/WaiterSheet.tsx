"use client";

import { useId, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { WAITER_REASONS } from "./constants";

type Props = {
  onClose: () => void;
  /** Seçilen neden ya da "Diğer" için yazılan açıklama */
  onSubmit: (reason: string) => void;
  sending: boolean;
};

/** Garson çağırma: nedenler gerçek bir radyo grubu (ok tuşlarıyla gezilir, seçim okunur) */
export default function WaiterSheet({ onClose, onSubmit, sending }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noteId = useId();
  const isOther = reason === "Diğer";
  const canSubmit = !!reason && (!isOther || !!note.trim()) && !sending;

  return (
    <Dialog onClose={onClose} overlayStyle={{ alignItems: "flex-end" }} contentClassName="modal-content modal-sheet" contentStyle={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>🙋 Garson Çağır</h2>
        <button type="button" aria-label="Kapat" className="tap-target" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <fieldset className="reason-group">
          <legend style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14 }}>
            Garsonun size daha hızlı yardımcı olabilmesi için nedeninizi seçin:
          </legend>
          {WAITER_REASONS.map(r => (
            <label key={r} className="reason-option">
              <input
                type="radio"
                name="waiter-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </fieldset>
        {isOther && (
          <>
            <label htmlFor={noteId} className="sr-only">Açıklama</label>
            <textarea id={noteId} value={note} onChange={e => setNote(e.target.value)} placeholder="Açıklama yazın..." maxLength={200} className="input" style={{ resize: "none", height: 60, marginBottom: 14 }} />
          </>
        )}
        <button
          type="button"
          onClick={() => onSubmit(isOther ? note.trim() : reason)}
          disabled={!canSubmit}
          className="btn btn-primary"
          style={{ width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 16 }}
        >
          {sending ? "Gönderiliyor..." : "Garson Çağır"}
        </button>
      </div>
    </Dialog>
  );
}
