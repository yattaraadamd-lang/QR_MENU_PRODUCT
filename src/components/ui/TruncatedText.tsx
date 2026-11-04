import { cn } from "@/lib/cn";

const WIDTH_CLASS = {
  md: "max-w-[12rem]",
  sm: "max-w-[8rem]",
} as const;

interface TruncatedTextProps {
  text: string;
  /** "sm": çok sütunlu tablodaki ikincil değer (slug) */
  width?: keyof typeof WIDTH_CLASS;
  className?: string;
}

/**
 * Tablo hücresinde uzun metin: tek satırda kırpılır, tam değer `title`'da ve DOM'da kalır.
 * Boşluksuz uzun değer (e-posta, ad) yoksa sütunu genişletip diğerlerini ekran dışına iter.
 */
export default function TruncatedText({ text, width = "md", className }: TruncatedTextProps) {
  return (
    <span title={text} className={cn("block truncate", WIDTH_CLASS[width], className)}>
      {text}
    </span>
  );
}
