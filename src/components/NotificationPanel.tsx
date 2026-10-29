"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useNotificationSound, NotificationItem } from "@/contexts/NotificationSoundContext";
import Dialog from "@/components/ui/Dialog";
import { Bell, X, CheckCheck, Volume2, VolumeX } from "lucide-react";

/**
 * 🔔 Premium Notification Panel Component
 *
 * Glassmorphism slide-in panel with:
 * - Type-based color bars and icon backgrounds
 * - Staggered entry animations
 * - Relative time display ("Az önce", "2 dk önce")
 * - Empty state illustration
 * - Swipe-to-dismiss on mobile (touch events)
 * - XSS-safe text: metinler React çocuğu olarak basılır, React kaçırır
 *   (elle kaçırmak "Masa 5'ten" metnini "Masa 5&#039;ten" gösteriyordu)
 * - Persistent toast for critical notifications (iOS-friendly)
 * - Unread badge with pulse animation on bell icon
 */

// ─── Relative time formatter ──────────────────────────────────────────────────
function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "Az önce";
  if (seconds < 60) return `${seconds} sn önce`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

// ─── Notification Panel ───────────────────────────────────────────────────────
export function NotificationPanel() {
  const {
    notifications,
    clearNotification,
    clearAll,
    mode,
    soundEnabled,
    audioUnlocked,
    enableSound,
    disableSound,
    newNotification,
    dismissToast,
    unreadCount,
    markAllRead,
  } = useNotificationSound();

  const [isOpen, setIsOpen] = useState(false);
  const [, setTick] = useState(0);

  // Update relative times every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Panel modal: açıkken zil etkisiz, yalnız açar. markAllRead state güncelleyicisinin
  // dışında: içeride çağrılınca React "render sırasında başka bileşeni güncelleme" uyarısı veriyordu
  const openPanel = useCallback(() => {
    markAllRead();
    setIsOpen(true);
  }, [markAllRead]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);
  // Odak tuzağı, Esc, arka planı etkisizleştirme ve odağın zile dönüşü Dialog'dan (yerel <dialog>)

  return (
    <>
      {/* Bell button with badge */}
      <NotificationBell
        count={notifications.length}
        unreadCount={unreadCount}
        onClick={openPanel}
      />

      {/* Ses kontrolü — açık/kapalı tercihi + tarayıcı kilidi durumu */}
      <SoundToggle
        mode={mode}
        soundEnabled={soundEnabled}
        audioUnlocked={audioUnlocked}
        onEnable={enableSound}
        onDisable={disableSound}
      />

      {/* Persistent Toast — kritik bildirimler elle kapatılana kadar kalır */}
      {newNotification && (
        <div
          className={`notification-toast ${newNotification.persistent ? "notification-toast-persistent" : ""}`}
          role={newNotification.persistent ? "alert" : "status"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
              {newNotification.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 2 }}>
                {newNotification.title}
              </div>
              <div style={{
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {newNotification.message}
              </div>
              {soundEnabled && !audioUnlocked && (
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--primary-light)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}>
                  <VolumeX size={12} />
                  Ses kilitli — açmak için ekrana dokunun
                </div>
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
      )}

      {/* Panel: sağdan açılan modal çekmece */}
      <Dialog open={isOpen} onClose={closePanel} overlayClassName="notification-dialog" contentClassName="notification-panel open">
        {/* Header */}
        <div className="notification-panel-header">
          {/* Dialog pencerenin adını ilk başlıktan alır: "Bildirimler (n)" */}
          <h2 className="notification-panel-title">
            <Bell size={20} aria-hidden="true" />
            Bildirimler
            {/* Satır içi span boşluk eklemez: ad "Bildirimler(1)" okunurdu */}
            {notifications.length > 0 && " "}
            {notifications.length > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
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
              onClick={closePanel}
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
              <div className="notification-empty-text">
                Tüm bildirimler okundu
              </div>
              <div className="notification-empty-sub">
                Yeni bildirimler burada görünecek
              </div>
            </div>
          ) : (
            <ul className="notification-list">
              {notifications.map((notif) => (
                <NotificationCard
                  key={notif.id}
                  notification={notif}
                  onDismiss={clearNotification}
                />
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
              <span>
                {mode === "admin"
                  ? "Sipariş ve ödeme talepleri sesli"
                  : "Sesli bildirimler aktif"}
              </span>
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
    </>
  );
}

// ─── Sound Toggle ─────────────────────────────────────────────────────────────
// 3 durum: kapalı (tercih) · kilitli (tarayıcı dokunuş bekliyor) · açık
function SoundToggle({
  mode,
  soundEnabled,
  audioUnlocked,
  onEnable,
  onDisable,
}: {
  mode: "waiter" | "admin";
  soundEnabled: boolean;
  audioUnlocked: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const baseStyle: React.CSSProperties = {
    height: 40,
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: "0.8125rem",
    transition: "all 0.2s ease",
  };

  // Açık ve çalışıyor → sade ikon, tıklayınca kapanır
  if (soundEnabled && audioUnlocked) {
    return (
      <button
        id="sound-toggle-btn"
        onClick={onDisable}
        style={{
          ...baseStyle,
          width: 40,
          border: "1px solid var(--border-color)",
          background: "rgba(40,30,25, 0.6)",
          color: "var(--success)",
        }}
        title={
          mode === "admin"
            ? "Sesli bildirimler açık (sipariş ve ödeme) — kapatmak için tıklayın"
            : "Sesli bildirimler açık — kapatmak için tıklayın"
        }
        aria-label="Sesli bildirimleri kapat"
      >
        <Volume2 size={18} />
      </button>
    );
  }

  // Tercih açık ama tarayıcı kilitli → ekrana herhangi bir dokunuş yeterli
  if (soundEnabled) {
    return (
      <button
        id="sound-toggle-btn"
        onClick={onEnable}
        style={{
          ...baseStyle,
          padding: "0 12px",
          border: "1px solid rgba(217,68,31, 0.5)",
          background: "rgba(217,68,31, 0.12)",
          color: "var(--primary-light)",
          animation: "pulse-glow 2s infinite",
        }}
        title="Tarayıcı sesi kilitledi — ekranın herhangi bir yerine dokunmanız yeterli"
      >
        <VolumeX size={16} />
        <span>Dokun, sesi aç</span>
      </button>
    );
  }

  // Tercih kapalı → garsonda dikkat çekici, adminde sade
  return (
    <button
      id="sound-toggle-btn"
      onClick={onEnable}
      style={
        mode === "waiter"
          ? {
              ...baseStyle,
              padding: "0 12px",
              border: "1px solid rgba(217,68,31, 0.3)",
              background: "rgba(217,68,31, 0.12)",
              color: "var(--primary-light)",
            }
          : {
              ...baseStyle,
              width: 40,
              border: "1px solid var(--border-color)",
              background: "rgba(40,30,25, 0.6)",
              color: "var(--text-muted)",
            }
      }
      title="Sesli bildirimler kapalı — açmak için tıklayın"
      aria-label="Sesli bildirimleri aç"
    >
      <VolumeX size={mode === "waiter" ? 16 : 18} />
      {mode === "waiter" && <span>Ses kapalı</span>}
    </button>
  );
}

// ─── Bell Button ──────────────────────────────────────────────────────────────
function NotificationBell({
  count,
  unreadCount,
  onClick,
}: {
  count: number;
  unreadCount: number;
  onClick: () => void;
}) {
  const hasUnread = unreadCount > 0;

  return (
    <button
      id="notification-bell"
      onClick={onClick}
      className={`notification-badge ${hasUnread ? "notification-bell-active" : ""}`}
      style={{
        width: 40,
        height: 40,
        borderRadius: "var(--radius-md)",
        border: hasUnread
          ? "1px solid rgba(239, 68, 68, 0.5)"
          : "1px solid var(--border-color)",
        background: hasUnread
          ? "rgba(239, 68, 68, 0.08)"
          : "rgba(40,30,25, 0.6)",
        color: hasUnread ? "#EF4444" : "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        position: "relative",
      }}
      title={hasUnread ? `${unreadCount} okunmamış bildirim` : "Bildirimler"}
      aria-label={hasUnread ? `Bildirimler, ${unreadCount} okunmamış` : "Bildirimler"}
    >
      <Bell size={18} aria-hidden="true" />
      {count > 0 && (
        <span className={`notification-badge-count ${hasUnread ? "pulse" : ""}`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ─── Individual Notification Card ─────────────────────────────────────────────
function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  // Touch handling for swipe-to-dismiss
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX === null) return;
      const diff = e.touches[0].clientX - touchStartX;
      if (diff > 0) {
        setTranslateX(Math.min(diff, 200));
      }
    },
    [touchStartX]
  );

  const handleTouchEnd = useCallback(() => {
    if (translateX > 100) {
      onDismiss(notification.id);
    } else {
      setTranslateX(0);
    }
    setTouchStartX(null);
  }, [translateX, notification.id, onDismiss]);

  return (
    <li
      className="notification-card"
      data-type={notification.type}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: translateX > 0 ? `translateX(${translateX}px)` : undefined,
        opacity: translateX > 0 ? 1 - translateX / 250 : undefined,
        transition: touchStartX !== null ? "none" : undefined,
      }}
    >
      {/* Icon */}
      <div className="notification-icon" aria-hidden="true">{notification.icon}</div>

      {/* Content (React metin kaçışı) */}
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">
          {notification.message}
        </div>
        <div className="notification-time">
          {relativeTime(notification.createdAt)}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        className="notification-dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        title="Bildirimi kaldır"
        // Liste içinde birden çok "kaldır" butonu var: hangisi olduğu adında
        aria-label={`${notification.title} bildirimini kaldır`}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

export default NotificationPanel;
