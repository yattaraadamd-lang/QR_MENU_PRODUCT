"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotificationList } from "../model/NotificationSoundContext";

/** Rozette en fazla iki hane */
const MAX_BADGE = 99;

/** Zil: toplam bildirim rozeti, okunmamış varsa kırmızı ve nabızlı. Yalnız liste bağlamını okur. */
export default function NotificationBell({ onClick }: { onClick: () => void }) {
  const { notifications, unreadCount } = useNotificationList();
  const count = notifications.length;
  const hasUnread = unreadCount > 0;
  const countText = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
  // Rozetteki sayı adın içinde (WCAG 2.5.3); okunmamış sayısı toplamdan farklı olabilir
  const name = [count > 0 ? `Bildirimler: ${countText}` : "Bildirimler", hasUnread && `${unreadCount} okunmamış`]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      id="notification-bell"
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        // Konum ve display .notification-badge'de (globals)
        "notification-badge size-10 shrink-0 items-center justify-center rounded-md border transition-colors",
        hasUnread ? "notification-bell-active border-danger/50 bg-danger/10 text-danger-fg" : "border-line bg-surface text-fg-secondary",
      )}
      title={hasUnread ? `${unreadCount} okunmamış bildirim` : "Bildirimler"}
      aria-label={name}
    >
      <Bell aria-hidden="true" className="size-[18px]" />
      {count > 0 && <span className={cn("notification-badge-count", hasUnread && "pulse")}>{countText}</span>}
    </button>
  );
}
