"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNotificationSound, NotificationItem } from "@/contexts/NotificationSoundContext";
import { Bell, X, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react";

/**
 * 🔔 Premium Notification Panel Component
 *
 * Glassmorphism slide-in panel with:
 * - Type-based color bars and icon backgrounds
 * - Staggered entry animations
 * - Relative time display ("Az önce", "2 dk önce")
 * - Empty state illustration
 * - Swipe-to-dismiss on mobile (touch events)
 * - XSS-safe text rendering via textContent
 */

// ─── Safe text sanitizer (XSS protection) ─────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    soundEnabled,
    enableSound,
    newNotification,
  } = useNotificationSound();

  const [isOpen, setIsOpen] = useState(false);
  const [, setTick] = useState(0);

  // Update relative times every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        closePanel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  return (
    <>
      {/* Bell button with badge */}
      <NotificationBell count={notifications.length} onClick={togglePanel} />

      {/* Sound enable button (separate) */}
      {!soundEnabled && (
        <button
          id="enable-sound-btn"
          onClick={enableSound}
          className="btn btn-sm"
          style={{
            background: "rgba(217, 119, 6, 0.12)",
            border: "1px solid rgba(217, 119, 6, 0.3)",
            color: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8125rem",
            padding: "6px 12px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
          title="Bildirimleri ses ile al"
        >
          <Volume2 size={16} />
          <span className="lg-hidden" style={{ display: "none" }}>Ses</span>
          <span>Sesi Aç</span>
        </button>
      )}

      {/* Toast */}
      {newNotification && (
        <div className="notification-toast">{newNotification}</div>
      )}

      {/* Overlay */}
      <div
        className={`notification-overlay ${isOpen ? "active" : ""}`}
        onClick={closePanel}
      />

      {/* Panel */}
      <div className={`notification-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="notification-panel-header">
          <div className="notification-panel-title">
            <Bell size={20} />
            Bildirimler
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
          </div>
          <div className="notification-panel-actions">
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color =
                    "var(--text-secondary)")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = "var(--text-muted)")
                }
                title="Tümünü temizle"
              >
                <CheckCheck size={14} />
                Temizle
              </button>
            )}
            <button
              onClick={closePanel}
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.background =
                  "rgba(239, 68, 68, 0.15)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.background = "transparent")
              }
              title="Paneli kapat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="notification-panel-body">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <div className="notification-empty-icon">🔔</div>
              <div className="notification-empty-text">
                Tüm bildirimler okundu
              </div>
              <div className="notification-empty-sub">
                Yeni bildirimler burada görünecek
              </div>
            </div>
          ) : (
            notifications.map((notif) => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                onDismiss={clearNotification}
              />
            ))
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
          {soundEnabled ? (
            <>
              <Volume2 size={14} style={{ color: "var(--success)" }} />
              <span>Sesli bildirimler aktif</span>
            </>
          ) : (
            <>
              <VolumeX size={14} />
              <span>Sesli bildirimler kapalı</span>
              <button
                onClick={enableSound}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Aç
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Bell Button ──────────────────────────────────────────────────────────────
function NotificationBell({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      id="notification-bell"
      onClick={onClick}
      className="notification-badge"
      style={{
        width: 40,
        height: 40,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-color)",
        background: "rgba(44, 36, 32, 0.6)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        position: "relative",
      }}
      title="Bildirimler"
    >
      <Bell size={18} />
      {count > 0 && (
        <span className={`notification-badge-count ${count > 0 ? "pulse" : ""}`}>
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
    <div
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
      <div className="notification-icon">{notification.icon}</div>

      {/* Content (XSS-safe via textContent) */}
      <div className="notification-content">
        <div className="notification-title">{escapeHtml(notification.title)}</div>
        <div className="notification-message">
          {escapeHtml(notification.message)}
        </div>
        <div className="notification-time">
          {relativeTime(notification.createdAt)}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        className="notification-dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        title="Bildirimi kaldır"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default NotificationPanel;
