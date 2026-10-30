"use client";

import type { CSSProperties } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useNotificationActions, useNotificationSoundState } from "@/contexts/NotificationSoundContext";

const baseStyle: CSSProperties = {
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

/**
 * Ses düğmesi, 3 durum: kapalı (tercih) · kilitli (tarayıcı dokunuş bekliyor) · açık.
 * Yalnız ses bağlamını okur: yeni bildirim bu düğmeyi yeniden çizmez.
 */
export default function SoundToggle() {
  const { mode, soundEnabled, audioUnlocked } = useNotificationSoundState();
  const { enableSound, disableSound } = useNotificationActions();

  // Açık ve çalışıyor → sade ikon, tıklayınca kapanır
  if (soundEnabled && audioUnlocked) {
    return (
      <button
        id="sound-toggle-btn"
        onClick={disableSound}
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
        onClick={enableSound}
        className="animate-pulse-glow"
        style={{
          ...baseStyle,
          padding: "0 12px",
          border: "1px solid rgba(217,68,31, 0.5)",
          background: "rgba(217,68,31, 0.12)",
          color: "var(--primary-light)",
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
      onClick={enableSound}
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
