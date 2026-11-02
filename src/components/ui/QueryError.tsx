import Alert from "./Alert";
import Button from "./Button";

/**
 * Liste sorgusu hatası (useApiQuery). role="alert" ile belirdiği an duyurulur; polling
 * sürdüğü için bağlantı dönünce kendiliğinden kalkar, "Tekrar dene" beklemeden yeniler.
 */
export default function QueryError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;
  return (
    <Alert
      tone="danger"
      role="alert"
      className="mb-3 font-semibold"
      action={
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Tekrar dene
        </Button>
      }
    >
      ⚠️ {message}
    </Alert>
  );
}
