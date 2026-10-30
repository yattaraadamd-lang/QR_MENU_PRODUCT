"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Volume2, VolumeX, X } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { useNotificationActions, useNotificationList, useNotificationSoundState } from "@/contexts/NotificationSoundContext";
import NotificationCard from "./NotificationCard";

/**
 * Sağdan açılan modal çekmece (yerel <dialog>): odak tuzağı, Esc, arka planı etkisizleştirme
 * ve odağın zile dönüşü Dialog'dan. Göreli zamanlar yalnız açıkken 30 sn'de bir tazelenir.
 */
export default function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications } = useNotificationList();
  const { mode, soundEnabled, audioUnlocked } = useNotificationSoundState();
  const { clearNotification, clearAll, enableSound, disableSound } = useNotificationActions();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} overlayClassName="notification-dialog" contentClassName="notification-panel open">
      {/* Header */}
      <div className="notification-panel-header">
        {/* Dialog pencerenin adını ilk başlıktan alır: "Bildirimler (n)" */}
        <h2 className="notification-panel-title">
          <Bell size={20} aria-hidden="true" />
          Bildirimler
          {/* Satır içi span boşluk eklemez: ad "Bildirimler(1)" okunurdu */}
          {notifications.length > 0 && " "}
          {notifications.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
              ({notifications.length})
            </span>
          )}
        </h2>
        <div className="notification-panel-actions">
          {notifications.length > 0 && (
            <button type="button" onClick={clearAll} className="notification-clear-btn" title="Tümünü temizle">
              <CheckCheck size={14} aria-hidden="true" />
              Temizle
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="notification-close-btn"
            title="Paneli kapat"
            aria-label="Paneli kapat"
            data-autofocus
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="notification-panel-body">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <div className="notification-empty-icon" aria-hidden="true">🔔</div>
            <div className="notification-empty-text">Tüm bildirimler okundu</div>
            <div className="notification-empty-sub">Yeni bildirimler burada görünecek</div>
          </div>
        ) : (
          <ul className="notification-list">
            {notifications.map((notif) => (
              <NotificationCard key={notif.id} notification={notif} onDismiss={clearNotification} />
            ))}
          </ul>
        )}
      </div>

      {/* Sound status footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {soundEnabled && audioUnlocked ? (
          <>
            <Volume2 size={14} style={{ color: "var(--success)" }} />
            <span>{mode === "admin" ? "Sipariş ve ödeme talepleri sesli" : "Sesli bildirimler aktif"}</span>
          </>
        ) : soundEnabled ? (
          <>
            <VolumeX size={14} style={{ color: "var(--primary-light)" }} />
            <span>Ses kilitli — ekrana dokunun</span>
          </>
        ) : (
          <>
            <VolumeX size={14} />
            <span>Sesli bildirimler kapalı</span>
          </>
        )}
        <button
          onClick={soundEnabled && audioUnlocked ? disableSound : enableSound}
          aria-label={soundEnabled && audioUnlocked ? "Sesli bildirimleri kapat" : "Sesli bildirimleri aç"}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary-light)",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          {soundEnabled && audioUnlocked ? "Kapat" : "Aç"}
        </button>
      </div>
    </Dialog>
  );
}
