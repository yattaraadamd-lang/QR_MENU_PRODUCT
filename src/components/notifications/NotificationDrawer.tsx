"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { useNotificationActions, useNotificationList } from "@/contexts/NotificationSoundContext";
import NotificationCard from "./NotificationCard";
import SoundStatus from "./SoundStatus";

/**
 * Sağdan açılan modal çekmece (yerel <dialog>): odak tuzağı, Esc, arka planı etkisizleştirme
 * ve odağın zile dönüşü Dialog'dan. Göreli zamanlar yalnız açıkken 30 sn'de bir tazelenir.
 */
export default function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications } = useNotificationList();
  const { clearNotification, clearAll } = useNotificationActions();
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
            <span className="text-xs font-medium text-fg-muted">({notifications.length})</span>
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

      <SoundStatus />
    </Dialog>
  );
}
