"use client";

import { Bell } from "lucide-react";
import { useNotificationList } from "@/contexts/NotificationSoundContext";

/** Zil: toplam bildirim rozeti, okunmamış varsa kırmızı ve nabızlı. Yalnız liste bağlamını okur. */
export default function NotificationBell({ onClick }: { onClick: () => void }) {
  const { notifications, unreadCount } = useNotificationList();
  const count = notifications.length;
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
