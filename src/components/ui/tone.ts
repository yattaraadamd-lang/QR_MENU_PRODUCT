/** Durum/vurgu tonu. Renk değerleri temada (globals.css), bileşenler yalnız tonu bilir. */
export type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "info" | "purple" | "neutral";

/** Tonun saydam zemini (ikon kutusu vb.); Tailwind tam sınıf adlarını görmeli, bu yüzden eşleme */
export const TONE_TINT: Readonly<Record<Tone, string>> = {
  primary: "bg-primary/10",
  accent: "bg-accent/10",
  success: "bg-success/10",
  warning: "bg-warning/15",
  danger: "bg-danger/10",
  info: "bg-info/10",
  purple: "bg-purple/10",
  neutral: "bg-surface-hover",
};

/** Tonun okunur yazı rengi (zeminde ≥4.5:1 temada ölçülür) */
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  primary: "text-primary-light",
  accent: "text-accent",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
  info: "text-info-fg",
  purple: "text-purple-fg",
  neutral: "text-fg",
};

/** Küçük büyük harfli bölüm etiketi ("ADİSYON", "TUTAR (₺)") — form etiketi ve alt başlıklar */
export const eyebrowClass = "text-xs font-semibold uppercase tracking-wider text-fg-secondary";
