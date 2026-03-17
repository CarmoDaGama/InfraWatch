-- CreateTable
CREATE TABLE "sla_violations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "device_id" INTEGER NOT NULL,
    "violation_type" TEXT NOT NULL,
    "actual_uptime" REAL NOT NULL,
    "sla_target" REAL NOT NULL,
    "period_start_at" DATETIME NOT NULL,
    "period_end_at" DATETIME NOT NULL,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sla_violations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sla_violations_device_id_idx" ON "sla_violations"("device_id");

-- CreateIndex
CREATE INDEX "sla_violations_created_at_idx" ON "sla_violations"("created_at");
