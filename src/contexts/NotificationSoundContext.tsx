"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";

export type NotificationItem = {
  id: string;
  type:
    | "new_order"
    | "call_waiter"
    | "payment_request"
    | "help_request"
    | "service_request";
  icon: string;
  title: string;
  message: string;
  tableNumber?: string;
  tableName?: string;
  createdAt: Date;
};

type NotificationSoundContextType = {
  soundEnabled: boolean;
  enableSound: () => void;
  newNotification: string | null;
  notifications: NotificationItem[];
  clearNotification: (id: string) => void;
  clearAll: () => void;
};

const NotificationSoundContext = createContext<
  NotificationSoundContextType | undefined
>(undefined);

// ─── Kalıcı AudioContext ──────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// ─── Melodi çalıcı ────────────────────────────────────────────────────────────
function playMelody(
  ctx: AudioContext,
  notes: Array<{ freq: number; start: number; duration: number; type?: OscillatorType }>,
  volume = 0.25
) {
  notes.forEach(({ freq, start, duration, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + start + duration
    );
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration);
  });
}

// ─── Ses efektleri ────────────────────────────────────────────────────────────
export function playSoundEffect(type: string) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    switch (type) {
      case "new_order":
      case "order":
        // Üçlü artan melodi (Do-Mi-Sol)
        playMelody(
          ctx,
          [
            { freq: 523, start: 0, duration: 0.15, type: "sine" },
            { freq: 659, start: 0.15, duration: 0.15, type: "sine" },
            { freq: 784, start: 0.3, duration: 0.25, type: "sine" },
          ],
          0.3
        );
        break;

      case "call_waiter":
      case "waiter_call":
        // Acil çağrı — hızlı tekrarlayan ikili ton
        playMelody(
          ctx,
          [
            { freq: 880, start: 0, duration: 0.12, type: "square" },
            { freq: 660, start: 0.12, duration: 0.12, type: "square" },
            { freq: 880, start: 0.28, duration: 0.12, type: "square" },
            { freq: 660, start: 0.4, duration: 0.12, type: "square" },
            { freq: 880, start: 0.56, duration: 0.12, type: "square" },
            { freq: 660, start: 0.68, duration: 0.15, type: "square" },
          ],
          0.2
        );
        break;

      case "payment":
      case "payment_request":
        // Ödeme talebi — soft rising arpej (La-Do#-Mi-La)
        playMelody(
          ctx,
          [
            { freq: 440, start: 0, duration: 0.18, type: "sine" },
            { freq: 554, start: 0.15, duration: 0.18, type: "sine" },
            { freq: 659, start: 0.3, duration: 0.18, type: "sine" },
            { freq: 880, start: 0.45, duration: 0.35, type: "sine" },
          ],
          0.25
        );
        break;

      case "urgent":
      case "help_request":
        // Acil uyarı
        playMelody(
          ctx,
          [
            { freq: 1047, start: 0, duration: 0.08, type: "sawtooth" },
            { freq: 1047, start: 0.12, duration: 0.08, type: "sawtooth" },
            { freq: 1047, start: 0.24, duration: 0.08, type: "sawtooth" },
            { freq: 1319, start: 0.36, duration: 0.15, type: "sawtooth" },
          ],
          0.18
        );
        break;

      default:
        // Varsayılan — basit "ding"
        playMelody(ctx, [{ freq: 587, start: 0, duration: 0.2, type: "sine" }], 0.2);
        break;
    }
  } catch {
    // Ses çalma hatası kullanıcıya yansıtılmaz
  }
}

// ─── XSS-safe text sanitizer ──────────────────────────────────────────────────
function sanitizeText(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .substring(0, 500); // Max length
}

// ─── Deduplication window (ms) ────────────────────────────────────────────────
const DEDUP_WINDOW_MS = 3000;

// ─── Auto-expiry (30 minutes) ─────────────────────────────────────────────────
const AUTO_EXPIRY_MS = 30 * 60 * 1000;

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationSoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newNotification, setNewNotification] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const soundEnabledRef = useRef(false);
  const recentNotifKeys = useRef<Map<string, number>>(new Map());

  // Ses tercihini session storage'dan geri yükle
  useEffect(() => {
    const saved = sessionStorage.getItem("waiterSoundEnabled");
    if (saved === "true") {
      setSoundEnabled(true);
      soundEnabledRef.current = true;
    }
  }, []);

  const enableSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume();
    playSoundEffect("default");
    setSoundEnabled(true);
    soundEnabledRef.current = true;
    sessionStorage.setItem("waiterSoundEnabled", "true");
  }, []);

  // ✅ SECURITY: Deduplication — prevent duplicate notifications from same event
  const isDuplicate = useCallback((type: string, tableNumber?: string): boolean => {
    const key = `${type}:${tableNumber || "?"}`;
    const now = Date.now();
    const lastSeen = recentNotifKeys.current.get(key);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return true;
    }
    recentNotifKeys.current.set(key, now);
    // Cleanup old keys
    for (const [k, t] of recentNotifKeys.current) {
      if (now - t > DEDUP_WINDOW_MS * 2) {
        recentNotifKeys.current.delete(k);
      }
    }
    return false;
  }, []);

  const addNotification = useCallback((item: NotificationItem) => {
    setNotifications((prev) => [item, ...prev].slice(0, 30));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const showToast = useCallback((msg: string) => {
    setNewNotification(msg);
    setTimeout(() => setNewNotification(null), 5000);
  }, []);

  // ✅ Auto-expiry: Remove notifications older than 30 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - AUTO_EXPIRY_MS;
      setNotifications((prev) =>
        prev.filter((n) => new Date(n.createdAt).getTime() > cutoff)
      );
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  // ─── Socket bağlantısı ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user.businessId) return;
    if (
      session.user.role !== "WAITER" &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "SUPER_ADMIN"
    )
      return;

    const businessId = session.user.businessId;

    // connectToBusinessRoom: reconnect sonrası otomatik odaya tekrar katılır
    const socket = connectToBusinessRoom(businessId);

    // ─── Event handler factory ──────────────────────────────────────────────
    const handle =
      (
        type: NotificationItem["type"],
        icon: string,
        title: string,
        soundType: string
      ) =>
      (data: Record<string, unknown>) => {
        // businessId izolasyonu — başka işletme verisi yanlışlıkla gelirse yoksay
        if (data._businessId && data._businessId !== businessId) return;

        // ✅ SECURITY: Deduplication
        const tableNum = data.tableNumber as string | undefined;
        if (isDuplicate(type, tableNum)) return;

        const tableLabel =
          sanitizeText(data.tableName) ||
          `Masa ${sanitizeText(data.tableNumber) || "?"}`;

        // Ses çal
        if (soundEnabledRef.current) {
          const ctx = getAudioContext();
          if (ctx && ctx.state === "suspended") {
            ctx.resume().then(() => playSoundEffect(soundType));
          } else {
            playSoundEffect(soundType);
          }
          // Garson çağrısı ve ödeme talebi için 3 sn sonra tekrar çal
          if (soundType === "call_waiter" || soundType === "payment") {
            setTimeout(() => {
              if (soundEnabledRef.current) playSoundEffect(soundType);
            }, 3000);
          }
        }

        const item: NotificationItem = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          icon,
          title,
          message:
            sanitizeText(data.message) ||
            `${tableLabel} ${title.toLowerCase()}`,
          tableNumber: tableNum,
          tableName: data.tableName as string | undefined,
          createdAt: new Date(),
        };
        addNotification(item);
        showToast(`${icon} ${tableLabel}: ${title}`);
      };

    const handlers = {
      new_order: handle("new_order", "🆕", "Yeni Sipariş", "new_order"),
      call_waiter: handle("call_waiter", "🙋", "Garson Çağrısı", "call_waiter"),
      payment_request: handle(
        "payment_request",
        "💳",
        "Ödeme Talebi",
        "payment"
      ),
      help_request: handle("help_request", "ℹ️", "Yardım Talebi", "urgent"),
      service_request: handle(
        "service_request",
        "🔔",
        "Hizmet Talebi",
        "default"
      ),
    };

    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));

    return () => {
      Object.entries(handlers).forEach(([event, fn]) =>
        socket.off(event, fn)
      );
    };
  }, [session, addNotification, showToast, isDuplicate]);

  return (
    <NotificationSoundContext.Provider
      value={{
        soundEnabled,
        enableSound,
        newNotification,
        notifications,
        clearNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationSoundContext.Provider>
  );
}

export function useNotificationSound() {
  const ctx = useContext(NotificationSoundContext);
  if (!ctx)
    throw new Error(
      "useNotificationSound must be used within NotificationSoundProvider"
    );
  return ctx;
}
