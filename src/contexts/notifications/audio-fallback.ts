/**
 * Web Audio kullanılamadığında (ya da çalamadığında) HTMLAudioElement ile kısa bip.
 * iOS'ta <audio> izni kullanıcı dokunuşu içinde play() → pause() ile açılır.
 */

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
export function unlockFallbackAudio(): void {
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

/** AudioContext başarısız olduğunda HTMLAudioElement ile beep çal */
export function playFallbackBeep(): void {
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

// ─── Vibration helper ─────────────────────────────────────────────────────────
export function vibrateDevice(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration API desteklenmiyor (iOS) — sessizce geç
  }
}
