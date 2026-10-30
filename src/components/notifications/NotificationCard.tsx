"use client";

import React, { useCallback, useState } from "react";
import { X } from "lucide-react";
import type { NotificationItem } from "@/contexts/NotificationSoundContext";

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

/** Tek bildirim kartı: mobilde sağa kaydırınca kaldırılır. Metinler React çocuğu (kaçışlı). */
export default function NotificationCard({
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
