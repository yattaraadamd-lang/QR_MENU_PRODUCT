"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { createDeduper, soundFor, STAFF_EVENT_NAMES, toNotification } from "./notifications/events";
import type { NotificationItem, NotificationSoundMode, NotificationType } from "./notifications/types";
import { useNotificationStore } from "./notifications/useNotificationStore";
import { useSoundUnlock } from "./notifications/useSoundUnlock";
import { useStaffSocket } from "./notifications/useStaffSocket";

export type { NotificationItem, NotificationSoundMode } from "./notifications/types";

/**
 * Personel bildirimleri (garson ve admin kabuğu). Parçalar ayrı modüllerde:
 *   - notifications/useSoundUnlock: ses tercihi + tarayıcı autoplay kilidi (audio.ts)
 *   - notifications/useNotificationStore: liste, okunmamış sayısı, toast
 *   - notifications/useStaffSocket + events: soket olayı → bildirim, ses, tekrar eleme
 *
 * Durum dört bağlamda: bildirim gelince yalnız liste/toast tüketicileri, ses tercihi
 * değişince yalnız ses tüketicileri çizilir. Eylem bağlamı hiç değişmez.
 */

type SoundState = {
  mode: NotificationSoundMode;
  /** Kullanıcının ses tercihi (localStorage'da kalıcı) */
  soundEnabled: boolean;
  /** Tarayıcı şu an ses çalmaya izin veriyor mu (autoplay kilidi açık mı) */
  audioUnlocked: boolean;
};

type ListState = {
  notifications: NotificationItem[];
  /** Okunmamış (henüz panel açılarak görülmemiş) bildirim sayısı */
  unreadCount: number;
};

type Actions = {
  /** Kullanıcı gesture'ı içinde çağrılır: tercihi açar, ses kilidini açar */
  enableSound: () => void;
  disableSound: () => void;
  dismissToast: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  markAllRead: () => void;
};

const SoundStateContext = createContext<SoundState | null>(null);
const ListContext = createContext<ListState | null>(null);
const ToastContext = createContext<NotificationItem | null | undefined>(undefined);
const ActionsContext = createContext<Actions | null>(null);

export function NotificationSoundProvider({
  children,
  mode = "waiter",
}: {
  children: React.ReactNode;
  mode?: NotificationSoundMode;
}) {
  const sound = useSoundUnlock(mode);
  const store = useNotificationStore();
  const [isDuplicate] = useState(createDeduper);

  useStaffSocket(STAFF_EVENT_NAMES, (event, data) => {
    const type = event as NotificationType;
    if (isDuplicate(type, data.tableNumber)) return;
    const effect = soundFor(type, mode);
    if (effect) sound.play(effect.sound, effect.repeatAfterMs);
    store.push(toNotification(type, data, mode));
  });

  const { soundEnabled, audioUnlocked, enableSound, disableSound } = sound;
  const { notifications, unreadCount, toast, dismissToast, clearNotification, clearAll, markAllRead } = store;

  const soundState = useMemo(() => ({ mode, soundEnabled, audioUnlocked }), [mode, soundEnabled, audioUnlocked]);
  const listState = useMemo(() => ({ notifications, unreadCount }), [notifications, unreadCount]);
  const actions = useMemo(
    () => ({ enableSound, disableSound, dismissToast, clearNotification, clearAll, markAllRead }),
    [enableSound, disableSound, dismissToast, clearNotification, clearAll, markAllRead],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <SoundStateContext.Provider value={soundState}>
        <ListContext.Provider value={listState}>
          <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>
        </ListContext.Provider>
      </SoundStateContext.Provider>
    </ActionsContext.Provider>
  );
}

function missingProvider(): never {
  throw new Error("Bildirim bağlamı NotificationSoundProvider içinde kullanılmalı");
}

export function useNotificationSoundState(): SoundState {
  return useContext(SoundStateContext) ?? missingProvider();
}

export function useNotificationList(): ListState {
  return useContext(ListContext) ?? missingProvider();
}

export function useNotificationToast(): NotificationItem | null {
  const toast = useContext(ToastContext);
  return toast === undefined ? missingProvider() : toast;
}

/** Kararlı eylemler: bu bağlamı okuyan bileşen bildirim ya da ses değişince çizilmez */
export function useNotificationActions(): Actions {
  return useContext(ActionsContext) ?? missingProvider();
}
