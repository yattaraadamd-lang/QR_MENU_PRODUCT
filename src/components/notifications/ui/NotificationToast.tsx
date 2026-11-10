"use client";

import { VolumeX, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotificationActions, useNotificationSoundState, useNotificationToast } from "../model/NotificationSoundContext";

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
      className={cn("notification-toast", toast.persistent && "notification-toast-persistent")}
      role={toast.persistent ? "alert" : "status"}
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="shrink-0 text-lg leading-none">
          {toast.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-sm font-semibold">{toast.title}</p>
          <p className="truncate text-[13px] text-fg-secondary">{toast.message}</p>
          {/* Tarayıcı sesi kilitli: ekrana herhangi bir dokunuş da açar, düğme bunu görünür kılar */}
          {soundEnabled && !audioUnlocked && (
            <button
              type="button"
              onClick={enableSound}
              className="mt-1.5 inline-flex min-h-7 items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-light"
            >
              <VolumeX aria-hidden="true" className="size-3" />
              Ses kilitli — sesi aç
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismissToast}
          title="Bildirimi kapat"
          aria-label="Bildirimi kapat"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:text-fg"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
