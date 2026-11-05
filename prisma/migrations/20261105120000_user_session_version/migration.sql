-- Oturum iptali: artırıldığında kullanıcının açık oturumları geçersiz olur.
-- Sabit varsayılanlı sütun eklemek tabloyu yeniden yazmaz (Postgres 11+).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
