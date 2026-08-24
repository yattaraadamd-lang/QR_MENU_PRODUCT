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
    | "service_request"
    | "order_request_update";
  icon: string;
  title: string;
  message: string;
  tableNumber?: string;
  tableName?: string;
  createdAt: Date;
  /** true → kritik bildirim, toast elle kapatılana kadar ekranda kalır */
  persistent?: boolean;
};

type NotificationSoundContextType = {
  soundEnabled: boolean;
  enableSound: () => void;
  newNotification: NotificationItem | null;
  dismissToast: () => void;
  notifications: NotificationItem[];
  clearNotification: (id: string) => void;
  clearAll: () => void;
  /** Okunmamış (henüz panel açılarak görülmemiş) bildirim sayısı */
  unreadCount: number;
  markAllRead: () => void;
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

// ─── iOS AudioContext unlock — 1ms silent buffer ──────────────────────────────
function unlockAudioContext(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.stop(ctx.currentTime + 0.001);
  } catch {
    // sessizce geç
  }
}

// ─── Base64 encoded minimal beep WAV (44 bytes header + 882 samples = ~1.8KB) ─
// 440Hz sine wave, 100ms, 8-bit mono, 22050Hz sample rate
const BASE64_BEEP_WAV =
  "UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YToFAACAj5iem6KnqqurrKqnpJ6YkYmBen" +
  "JqY11XUVBPUFRYXWB/f397dXBrZ2RhX19gYmVpcHZ8gYeNkpidn6GhoJ6bmJSQi4Z/eXJrZV9aVlNRUFBR" +
  "VFhcYWdtc3l/hYuRlpudoKGhoJ6cmJSPioR+d3FrZWBbV1RTUVBRU1dbaG5zdnuAhIiMj5KUlZWUk5GPlI" +
  "mEf3p0bmlkYFxZV1VUVFVXWV1hZmtwd3yBhYmNkJOVlpeXl5aUko+MiIR/enVwamViX1xaWFdWVldYWl1h" +
  "ZWludHl+g4eLj5KUlpeYmJeWlJKPjIiEf3p1cGplYl9cWlhXVldXWVtdYWVpbnN5foOHi4+SlJaXmJiYl5" +
  "WTkY6Lh4N+enVwbGdkYV5cWlhXV1dYWl1gZGhsc3h9goaKjpGTlZeYmJiXlpSTkI2Jhn95dG9sZ2RhXltZ" +
  "WFdXWFlbXmJmaW50eX6DhoyPkpWXmJiYmJeVk5CPjImFgXx3cm5qZ2RhXlxaWVhYWFlaXWBkZ2xwd3yBho" +
  "qOkZSWl5iYmJiWlJKQjYqGgn56dnJubGlmY2FfXVxbW1pbXF5hZGhsc3h8gYaJjZCTlZeYmJiYl5WTkY+M" +
  "iYWBfXl1cW5raGViYF9eXVxcXF1eYGNnaW10eX2ChomNkJOVl5iYmJiXlpSSkI2Kh4N/e3hzcG1qaGViYF9e" +
  "XV1dXl9hY2dqbnN4fYKGio2QkpSWl5eYmJeWlJKQjYqHg398eHRxbmtpZmRiYF9fXl5eX2BiZWhrbXJ3fIGF" +
  "iY2QkpSWl5eXl5aVk5GQjYqHhIF9eXZzcG5raWdlY2FgYF9fYGFjZWdqbnJ2e4CFilCNkJKUlZaXl5eWlZSS" +
  "kI6LiIWCfnp3dHJwbWtpZ2VkY2JiYmJjZGZoamxwc3d7gISIi4+Rk5WWl5eXlpWUkpCOi4mGg4B8eXZzcW9t" +
  "a2lnZmVkZGRkZWZnaWtucHN3e3+Dh4uOkJKUlZaXl5eWlZOSkI6MiYaDgHx5dnRyb21samhnZmVlZWVl";

// ─── Fallback HTMLAudioElement ────────────────────────────────────────────────
let fallbackAudio: HTMLAudioElement | null = null;
let fallbackAudioUnlocked = false;

function getFallbackAudio(): HTMLAudioElement | null {
  try {
    if (!fallbackAudio) {
      fallbackAudio = new Audio(`data:audio/wav;base64,${BASE64_BEEP_WAV}`);
      fallbackAudio.volume = 0.3;
      fallbackAudio.preload = "auto";
    }
    return fallbackAudio;
  } catch {
    return null;
  }
}

/**
 * iOS'ta <audio>.play() izni almak için kullanıcı gesture'ı içinde çağrılır.
 * audio.play().then(() => audio.pause()) — iOS media session unlock.
 */
function unlockFallbackAudio(): void {
  const audio = getFallbackAudio();
  if (!audio || fallbackAudioUnlocked) return;
  try {
    audio.volume = 0.01; // neredeyse sessiz
    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.3; // normal ses seviyesine geri dön
          fallbackAudioUnlocked = true;
        })
        .catch(() => {
          // iOS izin vermedi — normal, kullanıcı gesture olmadan çalışmıyor
        });
    }
  } catch {
    // sessizce geç
  }
}

/**
 * Fallback olarak HTMLAudioElement ile beep çal.
 * AudioContext başarısız olduğunda kullanılır.
 */
function playFallbackBeep(): void {
  const audio = getFallbackAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.volume = 0.3;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Ses çalınamadı — sessizce geç
      });
    }
  } catch {
    // sessizce geç
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

// ─── Vibration helper ─────────────────────────────────────────────────────────
function vibrateDevice(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration API desteklenmiyor (iOS) — sessizce geç
  }
}

// ─── Ses efektleri ────────────────────────────────────────────────────────────
export function playSoundEffect(type: string) {
  const ctx = getAudioContext();

  // AudioContext varsa ve running ise → OscillatorNode ile ses çal
  if (ctx && ctx.state === "running") {
    try {
      switch (type) {
        case "new_order":
        case "order":
        case "order_request_update":
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
          vibrateDevice([200, 100, 200]);
          return; // Başarılı — fallback'e gerek yok

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
          vibrateDevice([300, 100, 300, 100, 300]);
          return;

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
          vibrateDevice([200, 100, 200]);
          return;

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
          vibrateDevice([100, 50, 100, 50, 100, 50, 200]);
          return;

        default:
          // Varsayılan — basit "ding"
          playMelody(ctx, [{ freq: 587, start: 0, duration: 0.2, type: "sine" }], 0.2);
          vibrateDevice(150);
          return;
      }
    } catch {
      // AudioContext ses çalamadı — fallback'e düş
    }
  }

  // ─── FALLBACK: AudioContext kullanılamıyorsa HTMLAudioElement ile beep çal ──
  playFallbackBeep();
  vibrateDevice([200, 100, 200]);
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

// ─── Silent buffer keep-alive interval (25 seconds) ───────────────────────────
const KEEPALIVE_INTERVAL_MS = 25000;

// ─── Kritik bildirim türleri — toast kalıcı olacak ────────────────────────────
const CRITICAL_TYPES = new Set([
  "new_order",
  "order_request_update",
  "call_waiter",
  "help_request",
]);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationSoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newNotification, setNewNotification] = useState<NotificationItem | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const soundEnabledRef = useRef(false);
  const recentNotifKeys = useRef<Map<string, number>>(new Map());
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ses tercihini session storage'dan geri yükle
  useEffect(() => {
    const saved = sessionStorage.getItem("waiterSoundEnabled");
    if (saved === "true") {
      setSoundEnabled(true);
      soundEnabledRef.current = true;
    }
  }, []);

  // ─── Global touch/click listener — iOS AudioContext resume ────────────────
  useEffect(() => {
    function resumeAudioOnInteraction() {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    }

    // Passive listener — performans dostu, iOS scroll engellemiyor
    document.addEventListener("touchstart", resumeAudioOnInteraction, { passive: true });
    document.addEventListener("click", resumeAudioOnInteraction, { passive: true });

    return () => {
      document.removeEventListener("touchstart", resumeAudioOnInteraction);
      document.removeEventListener("click", resumeAudioOnInteraction);
    };
  }, []);

  // ─── Silent buffer keep-alive — AudioContext suspend olmasını engelle ──────
  useEffect(() => {
    if (!soundEnabled) return;

    keepAliveTimerRef.current = setInterval(() => {
      if (audioCtx && audioCtx.state === "running") {
        try {
          // 1 sample'lık sessiz buffer çal — AudioContext'i canlı tut
          const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start(0);
        } catch {
          // sessizce geç
        }
      }
    }, KEEPALIVE_INTERVAL_MS);

    return () => {
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
    };
  }, [soundEnabled]);

  // ─── Enable sound — Kullanıcı gesture'ı içinde AudioContext + Audio unlock ─
  const enableSound = useCallback(() => {
    // 1. AudioContext oluştur ve unlock et
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // iOS unlock trick: 1ms silent buffer
      unlockAudioContext(ctx);
    }

    // 2. Fallback <audio> elementini de aynı gesture içinde unlock et
    unlockFallbackAudio();

    // 3. Kullanıcıya feedback — kısa ding sesi
    playSoundEffect("default");

    // 4. State güncelle
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
    setUnreadCount((prev) => prev + 1);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // ─── Toast göster — kritik bildirimler kalıcı, diğerleri 5sn ──────────────
  const showToast = useCallback((item: NotificationItem) => {
    // Önceki toast timer'ını temizle
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setNewNotification(item);

    // Kritik bildirimler → kalıcı toast (elle kapatılana kadar)
    if (item.persistent) {
      // Timer yok — toast elle kapatılana kadar kalır
      return;
    }

    // Normal bildirimler → 5 saniye sonra kapat
    toastTimerRef.current = setTimeout(() => {
      setNewNotification(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setNewNotification(null);
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

    // ✅ FIX: accessToken yoksa socket bağlantısı başlatma
    const accessToken = (session as any).accessToken;
    if (!accessToken) return;

    const businessId = session.user.businessId;

    // connectToBusinessRoom: reconnect sonrası otomatik odaya tekrar katılır
    const socket = connectToBusinessRoom(accessToken);

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
            ctx.resume().then(() => playSoundEffect(soundType)).catch(() => {
              // resume başarısız — fallback çal
              playFallbackBeep();
              vibrateDevice([200, 100, 200]);
            });
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

        const isCritical = CRITICAL_TYPES.has(type);

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
          persistent: isCritical,
        };
        addNotification(item);
        showToast(item);
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
      // ✅ YENİ: Masa açma talebi (ORDER_REQUEST) bildirimi
      order_request_update: handle(
        "order_request_update",
        "🔓",
        "Masa Açma Talebi",
        "order_request_update"
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
        dismissToast,
        notifications,
        clearNotification,
        clearAll,
        unreadCount,
        markAllRead,
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
