"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext, keepAudioAlive, playSoundEffect, playWhenReady, unlockAudio } from "./audio";
import type { NotificationSoundMode } from "./types";

// ─── Silent buffer keep-alive interval (25 seconds) ───────────────────────────
const KEEPALIVE_INTERVAL_MS = 25000;

// ─── Ses tercihi — localStorage, panel bazında ────────────────────────────────
const DEFAULT_SOUND_PREF: Record<NotificationSoundMode, boolean> = {
  waiter: true,
  admin: false,
};

const soundPrefKey = (mode: NotificationSoundMode) => `notificationSound:${mode}`;

function readSoundPref(mode: NotificationSoundMode): boolean {
  try {
    const saved = localStorage.getItem(soundPrefKey(mode));
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // storage erişilemiyor (gizli sekme vb.) — varsayılana düş
  }
  return DEFAULT_SOUND_PREF[mode];
}

function writeSoundPref(mode: NotificationSoundMode, enabled: boolean): void {
  try {
    localStorage.setItem(soundPrefKey(mode), String(enabled));
  } catch {
    // sessizce geç
  }
}

/**
 * Ses tercihi + tarayıcının autoplay kilidi. Kilit kapalıyken gelen son sesi saklar ve
 * sayfadaki ilk dokunuşta çalar. `play` her çizimde aynı kalır (ref'lerle okur).
 */
export function useSoundUnlock(mode: NotificationSoundMode) {
  const [soundEnabled, setSoundEnabled] = useState(DEFAULT_SOUND_PREF[mode]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const soundEnabledRef = useRef(DEFAULT_SOUND_PREF[mode]);
  const audioUnlockedRef = useRef(false);
  /** Ses kilitliyken gelen son bildirimin sesi — ilk dokunuşta çalınır */
  const pendingSoundRef = useRef<string | null>(null);

  // Ses tercihini localStorage'dan geri yükle
  useEffect(() => {
    const pref = readSoundPref(mode);
    setSoundEnabled(pref);
    soundEnabledRef.current = pref;
  }, [mode]);

  // ─── AudioContext durumunu izle — kilit gerçekten açık mı? ────────────────
  useEffect(() => {
    // Tarayıcı izin veriyorsa (ör. ana ekrana eklenmiş PWA) context
    // doğrudan "running" başlar ve hiç dokunmaya gerek kalmaz.
    const ctx = getAudioContext();
    if (!ctx) {
      // Web Audio yok — fallback <audio> ile en iyi çabayı göster
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      return;
    }

    function syncState() {
      const running = ctx!.state === "running";
      audioUnlockedRef.current = running;
      setAudioUnlocked(running);
      if (running && pendingSoundRef.current && soundEnabledRef.current) {
        const pending = pendingSoundRef.current;
        pendingSoundRef.current = null;
        playSoundEffect(pending);
      }
    }

    syncState();
    ctx.addEventListener("statechange", syncState);
    return () => ctx.removeEventListener("statechange", syncState);
  }, []);

  // ─── Sayfadaki HERHANGİ bir dokunuş/tıklama/tuş sesi açar ─────────────────
  useEffect(() => {
    function unlockOnInteraction() {
      if (!soundEnabledRef.current || audioUnlockedRef.current) return;
      unlockAudio();
    }

    function resumeOnVisible() {
      // Sekmeye geri dönüldüğünde (iOS arka plandan dönüş) context'i canlandır
      if (document.visibilityState === "visible" && soundEnabledRef.current) {
        getAudioContext();
      }
    }

    // touchend/click/keydown tarayıcıların "kullanıcı etkileşimi" saydığı olaylar
    const events = ["pointerdown", "touchend", "click", "keydown"] as const;
    events.forEach((e) => document.addEventListener(e, unlockOnInteraction, { capture: true, passive: true }));
    document.addEventListener("visibilitychange", resumeOnVisible);

    return () => {
      events.forEach((e) => document.removeEventListener(e, unlockOnInteraction, { capture: true }));
      document.removeEventListener("visibilitychange", resumeOnVisible);
    };
  }, []);

  // ─── Silent buffer keep-alive — AudioContext suspend olmasını engelle ──────
  useEffect(() => {
    if (!soundEnabled) return;
    const timer = setInterval(keepAudioAlive, KEEPALIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [soundEnabled]);

  // ─── Enable sound — Kullanıcı gesture'ı içinde AudioContext + Audio unlock ─
  const enableSound = useCallback(() => {
    // 1. AudioContext + fallback <audio> kilidini aynı gesture içinde aç
    unlockAudio();

    // 2. State güncelle (bekleyen ses varsa ding yerine o çalınsın diye önce)
    setSoundEnabled(true);
    soundEnabledRef.current = true;
    writeSoundPref(mode, true);

    // 3. Kullanıcıya feedback — kısa ding sesi
    pendingSoundRef.current = null;
    playWhenReady("default");
  }, [mode]);

  const disableSound = useCallback(() => {
    setSoundEnabled(false);
    soundEnabledRef.current = false;
    pendingSoundRef.current = null;
    writeSoundPref(mode, false);
  }, [mode]);

  /** Tercih açıksa çal; kilitliyse ilk dokunuşa sakla. repeatAfterMs: aynı sesi bir kez daha */
  const play = useCallback((soundType: string, repeatAfterMs?: number) => {
    if (!soundEnabledRef.current) return;
    if (!audioUnlockedRef.current) {
      // Tarayıcı sesi kilitli — ekrana ilk dokunuşta çalınacak
      pendingSoundRef.current = soundType;
      return;
    }
    playSoundEffect(soundType);
    if (repeatAfterMs) {
      setTimeout(() => {
        if (soundEnabledRef.current) playSoundEffect(soundType);
      }, repeatAfterMs);
    }
  }, []);

  return { soundEnabled, audioUnlocked, enableSound, disableSound, play };
}
