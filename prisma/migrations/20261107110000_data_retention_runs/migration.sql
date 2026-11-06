-- Saklama işinin çalışma kaydı (imha kaydı). Kişisel veri içermez: yalnız zaman ve sayılar.
-- İdempotent: canlı geçmişi db push + resolve ile karışık.
CREATE TABLE IF NOT EXISTS "data_retention_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "counts" JSONB,
    "error" TEXT,

    CONSTRAINT "data_retention_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "data_retention_runs_startedAt_idx" ON "data_retention_runs"("startedAt");
