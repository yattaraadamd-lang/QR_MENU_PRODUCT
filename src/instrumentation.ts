/**
 * Next sunucusu açılırken bir kez çalışır (server.js içinden de). Saklama işi kişisel verileri geri
 * alınamaz biçimde sildiği için yalnız DATA_RETENTION_MODE açıkça verilirse başlar.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const mode = process.env.DATA_RETENTION_MODE;
  if (mode !== "dry-run" && mode !== "apply") return;

  const { startDataRetentionScheduler } = await import("@/lib/services/data-retention.service");
  startDataRetentionScheduler(mode);
}
