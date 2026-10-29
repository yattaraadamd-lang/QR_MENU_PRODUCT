/**
 * Form/modal içi hata satırı. Açık bir <dialog> varken toast kullanılmaz:
 * modal üst katmanda (top layer) çizildiği için toast örtünün arkasında kalır.
 * role="alert" ile belirdiği an ekran okuyucuya duyurulur.
 */
export default function FormError({ message, style }: { message: string | null | undefined; style?: React.CSSProperties }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: "var(--danger-text)", lineHeight: 1.5, ...style }}>
      ⚠️ {message}
    </p>
  );
}
