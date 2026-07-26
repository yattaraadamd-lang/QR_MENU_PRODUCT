"use client";

import React from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

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
  children?: React.ReactNode;
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
  const iconBg = isDanger ? "rgba(220,38,38,0.1)" : "rgba(245,158,11,0.1)";
  const iconColor = isDanger ? "#DC2626" : "#F59E0B";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, maxWidth: 400 }}
      >
        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isDanger ? (
              <Trash2 size={20} color={iconColor} />
            ) : (
              <AlertTriangle size={20} color={iconColor} />
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
            {description && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {children && <div style={{ marginBottom: 16 }}>{children}</div>}

        <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ flex: 1 }}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${isDanger ? "btn-danger" : "btn-warning"}`}
            style={{ flex: 1 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                İşleniyor...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
