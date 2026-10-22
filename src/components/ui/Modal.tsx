"use client";

import React from "react";
import { X } from "lucide-react";
import Dialog from "./Dialog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  bottomSheet?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 500,
  bottomSheet = false,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayStyle={bottomSheet ? { alignItems: "flex-end" } : undefined}
      contentStyle={{
        maxWidth,
        ...(bottomSheet
          ? {
              borderRadius: "20px 20px 0 0",
              margin: 0,
              maxHeight: "85vh",
            }
          : {}),
      }}
    >
      {title && (
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            ...(bottomSheet
              ? {
                  position: "sticky",
                  top: 0,
                  background: "inherit",
                  zIndex: 1,
                  borderRadius: "20px 20px 0 0",
                }
              : {}),
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--bg-hover)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <div style={{ padding: title ? "16px 20px 20px" : "24px" }}>
        {children}
      </div>
    </Dialog>
  );
}
