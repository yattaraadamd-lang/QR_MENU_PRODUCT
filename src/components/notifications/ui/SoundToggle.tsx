"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotificationActions, useNotificationSoundState } from "../model/NotificationSoundContext";

const BASE = "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border text-[13px] transition-colors";
const ICON_ONLY = "w-10 border-line bg-surface";
const ATTENTION = "bg-primary/10 px-3 text-primary-light";

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
        type="button"
        onClick={disableSound}
        className={cn(BASE, ICON_ONLY, "text-success")}
        title={
          mode === "admin"
            ? "Sesli bildirimler açık (sipariş ve ödeme) — kapatmak için tıklayın"
            : "Sesli bildirimler açık — kapatmak için tıklayın"
        }
        aria-label="Sesli bildirimleri kapat"
      >
        <Volume2 aria-hidden="true" className="size-[18px]" />
      </button>
    );
  }

  // Tercih açık ama tarayıcı kilitli → ekrana herhangi bir dokunuş yeterli
  if (soundEnabled) {
    return (
      <button
        id="sound-toggle-btn"
        type="button"
        onClick={enableSound}
        className={cn(BASE, ATTENTION, "animate-pulse-glow border-primary/50")}
        title="Tarayıcı sesi kilitledi — ekranın herhangi bir yerine dokunmanız yeterli"
      >
        <VolumeX aria-hidden="true" className="size-4" />
        <span>Dokun, sesi aç</span>
      </button>
    );
  }

  // Tercih kapalı → garsonda dikkat çekici (görünen metin adın içinde), adminde sade
  if (mode === "waiter") {
    return (
      <button
        id="sound-toggle-btn"
        type="button"
        onClick={enableSound}
        className={cn(BASE, ATTENTION, "border-primary/30")}
        title="Sesli bildirimler kapalı — açmak için tıklayın"
        aria-label="Ses kapalı, sesli bildirimleri aç"
      >
        <VolumeX aria-hidden="true" className="size-4" />
        <span>Ses kapalı</span>
      </button>
    );
  }

  return (
    <button
      id="sound-toggle-btn"
      type="button"
      onClick={enableSound}
      className={cn(BASE, ICON_ONLY, "text-fg-muted")}
      title="Sesli bildirimler kapalı — açmak için tıklayın"
      aria-label="Sesli bildirimleri aç"
    >
      <VolumeX aria-hidden="true" className="size-[18px]" />
    </button>
  );
}
