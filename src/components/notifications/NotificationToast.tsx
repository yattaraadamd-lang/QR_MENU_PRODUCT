"use client";

import { VolumeX, X } from "lucide-react";
import { useNotificationActions, useNotificationSoundState, useNotificationToast } from "@/contexts/NotificationSoundContext";

/**
 * Son bildirimin toast'ı. Kritik olanlar (persistent) elle kapatılana kadar kalır ve
 * role="alert" ile hemen duyurulur; diğerleri role="status" ile 5 sn görünür.
 */
export default function NotificationToast() {
  const toast = useNotificationToast();
  const { soundEnabled, audioUnlocked } = useNotificationSoundState();
  const { dismissToast, enableSound } = useNotificationActions();
  if (!toast) return null;

  return (
    <div
      className={`notification-toast ${toast.persistent ? "notification-toast-persistent" : ""}`}
      role={toast.persistent ? "alert" : "status"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
          {toast.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 2 }}>
            {toast.title}
          </div>
          <div style={{
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {toast.message}
          </div>
          {/* Tarayıcı sesi kilitli: ekrana herhangi bir dokunuş da açar, düğme bunu görünür kılar */}
          {soundEnabled && !audioUnlocked && (
            <button
              type="button"
              onClick={enableSound}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--primary-light)",
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                minHeight: 28,
                borderRadius: 8,
                border: "1px solid rgba(217,68,31,0.4)",
                background: "rgba(217,68,31,0.12)",
                cursor: "pointer",
              }}
            >
              <VolumeX size={12} aria-hidden="true" />
              Ses kilitli — sesi aç
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismissToast}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 4,
            minWidth: 24,
            minHeight: 24,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title="Bildirimi kapat"
          aria-label="Bildirimi kapat"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
