import { playFallbackBeep, unlockFallbackAudio, vibrateDevice } from "./audio-fallback";

/**
 * Bildirim sesleri: tek ve kalıcı AudioContext üzerinde osilatör melodileri. Tarayıcının
 * autoplay kilidi kullanıcı dokunuşuyla açılır (unlockAudio); Web Audio çalamazsa
 * <audio> yedeği (audio-fallback.ts) devreye girer.
 */

// ─── Kalıcı AudioContext ──────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
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
function playSilentBuffer(ctx: AudioContext, stopAfter?: number): void {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (stopAfter !== undefined) source.stop(ctx.currentTime + stopAfter);
  } catch {
    // sessizce geç
  }
}

/**
 * Tarayıcının autoplay kilidini açar. Sadece kullanıcı gesture'ı
 * (dokunma, tıklama, tuş) içinde çağrıldığında etkilidir.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state !== "running") {
    ctx.resume().catch(() => {});
    playSilentBuffer(ctx, 0.001);
  }
  unlockFallbackAudio();
}

/** Silent buffer keep-alive: çalışan AudioContext'in askıya alınmasını engeller */
export function keepAudioAlive(): void {
  if (audioCtx && audioCtx.state === "running") playSilentBuffer(audioCtx);
}

/** Gesture içinde: AudioContext henüz running değilse resume bekleyip çal */
export function playWhenReady(type: string): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state !== "running") {
    ctx
      .resume()
      .then(() => playSoundEffect(type))
      .catch(() => {
        playFallbackBeep();
        vibrateDevice([200, 100, 200]);
      });
  } else {
    playSoundEffect(type);
  }
}

// ─── Melodi çalıcı ────────────────────────────────────────────────────────────
type Note = { freq: number; start: number; duration: number; type?: OscillatorType };

function playMelody(ctx: AudioContext, notes: Note[], volume = 0.25) {
  notes.forEach(({ freq, start, duration, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration);
  });
}

// ─── Ses efektleri ────────────────────────────────────────────────────────────
const SOUNDS: Record<string, { notes: Note[]; volume: number; vibrate: number | number[] }> = {
  // Üçlü artan melodi (Do-Mi-Sol)
  order: {
    notes: [
      { freq: 523, start: 0, duration: 0.15, type: "sine" },
      { freq: 659, start: 0.15, duration: 0.15, type: "sine" },
      { freq: 784, start: 0.3, duration: 0.25, type: "sine" },
    ],
    volume: 0.3,
    vibrate: [200, 100, 200],
  },
  // Acil çağrı — hızlı tekrarlayan ikili ton
  call: {
    notes: [
      { freq: 880, start: 0, duration: 0.12, type: "square" },
      { freq: 660, start: 0.12, duration: 0.12, type: "square" },
      { freq: 880, start: 0.28, duration: 0.12, type: "square" },
      { freq: 660, start: 0.4, duration: 0.12, type: "square" },
      { freq: 880, start: 0.56, duration: 0.12, type: "square" },
      { freq: 660, start: 0.68, duration: 0.15, type: "square" },
    ],
    volume: 0.2,
    vibrate: [300, 100, 300, 100, 300],
  },
  // Ödeme talebi — soft rising arpej (La-Do#-Mi-La)
  payment: {
    notes: [
      { freq: 440, start: 0, duration: 0.18, type: "sine" },
      { freq: 554, start: 0.15, duration: 0.18, type: "sine" },
      { freq: 659, start: 0.3, duration: 0.18, type: "sine" },
      { freq: 880, start: 0.45, duration: 0.35, type: "sine" },
    ],
    volume: 0.25,
    vibrate: [200, 100, 200],
  },
  // Acil uyarı
  urgent: {
    notes: [
      { freq: 1047, start: 0, duration: 0.08, type: "sawtooth" },
      { freq: 1047, start: 0.12, duration: 0.08, type: "sawtooth" },
      { freq: 1047, start: 0.24, duration: 0.08, type: "sawtooth" },
      { freq: 1319, start: 0.36, duration: 0.15, type: "sawtooth" },
    ],
    volume: 0.18,
    vibrate: [100, 50, 100, 50, 100, 50, 200],
  },
  // Varsayılan — basit "ding"
  default: { notes: [{ freq: 587, start: 0, duration: 0.2, type: "sine" }], volume: 0.2, vibrate: 150 },
};

const SOUND_ALIASES: Record<string, keyof typeof SOUNDS> = {
  new_order: "order",
  order: "order",
  order_request_update: "order",
  call_waiter: "call",
  waiter_call: "call",
  payment: "payment",
  payment_request: "payment",
  urgent: "urgent",
  help_request: "urgent",
};

export function playSoundEffect(type: string) {
  const ctx = getAudioContext();

  // AudioContext varsa ve running ise → OscillatorNode ile ses çal
  if (ctx && ctx.state === "running") {
    try {
      const sound = SOUNDS[SOUND_ALIASES[type] ?? "default"];
      playMelody(ctx, sound.notes, sound.volume);
      vibrateDevice(sound.vibrate);
      return; // Başarılı — fallback'e gerek yok
    } catch {
      // AudioContext ses çalamadı — fallback'e düş
    }
  }

  // ─── FALLBACK: AudioContext kullanılamıyorsa HTMLAudioElement ile beep çal ──
  playFallbackBeep();
  vibrateDevice([200, 100, 200]);
}
