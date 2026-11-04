"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useNotificationActions,
  useNotificationSoundState,
  type NotificationSoundMode,
} from "@/contexts/NotificationSoundContext";

/** Durumun simgesi ve metni: kapalı (tercih) · kilitli (tarayıcı dokunuş bekliyor) · açık */
function describeSound(soundEnabled: boolean, audioUnlocked: boolean, mode: NotificationSoundMode) {
  if (!soundEnabled) return { Icon: VolumeX, iconClass: undefined, text: "Sesli bildirimler kapalı" };
  if (!audioUnlocked) return { Icon: VolumeX, iconClass: "text-primary-light", text: "Ses kilitli — ekrana dokunun" };
  return {
    Icon: Volume2,
    iconClass: "text-success",
    text: mode === "admin" ? "Sipariş ve ödeme talepleri sesli" : "Sesli bildirimler aktif",
  };
}

/** Bildirim çekmecesinin alt satırı: ses durumu ve aç/kapat */
export default function SoundStatus() {
  const { mode, soundEnabled, audioUnlocked } = useNotificationSoundState();
  const { enableSound, disableSound } = useNotificationActions();
  const active = soundEnabled && audioUnlocked;
  const { Icon, iconClass, text } = describeSound(soundEnabled, audioUnlocked, mode);

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-t border-line px-4 py-3 text-xs text-fg-muted">
      <Icon aria-hidden="true" className={cn("size-3.5", iconClass)} />
      <span>{text}</span>
      <button
        type="button"
        onClick={active ? disableSound : enableSound}
        aria-label={active ? "Sesli bildirimleri kapat" : "Sesli bildirimleri aç"}
        className="inline-flex min-h-6 min-w-6 items-center justify-center font-semibold text-primary-light underline"
      >
        {active ? "Kapat" : "Aç"}
      </button>
    </div>
  );
}
