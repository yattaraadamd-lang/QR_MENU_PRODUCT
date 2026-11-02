"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";
import Dialog from "./Dialog";
import modalStyles from "./Modal.module.css";
import { TONE_TINT } from "./tone";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Onayla",
  cancelText = "Vazgeç",
  variant = "danger",
  loading = false,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = variant === "danger";
  const Icon = isDanger ? Trash2 : AlertTriangle;

  return (
    <Dialog onClose={onClose} contentClassName={cn("modal-content p-6", modalStyles.sm)}>
      <div className="mb-4 flex gap-3.5">
        <div
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md",
            TONE_TINT[variant],
            isDanger ? "text-danger-fg" : "text-warning-fg",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="mb-1 text-lg font-bold text-fg">{title}</h2>
          {description && <p className="text-sm leading-normal text-fg-secondary">{description}</p>}
        </div>
      </div>

      {children && <div className="mb-4">{children}</div>}

      <div className="flex gap-2 pt-2">
        {/* Açılışta odak geri dönülebilir seçenekte: Enter'a yanlışlıkla basmak işlemi onaylamasın */}
        <Button variant="ghost" className="flex-1" disabled={loading} onClick={onClose} data-autofocus>
          {cancelText}
        </Button>
        <Button variant={isDanger ? "danger" : "warning"} className="flex-1" loading={loading} onClick={onConfirm}>
          {loading ? "İşleniyor..." : confirmText}
        </Button>
      </div>
    </Dialog>
  );
}
