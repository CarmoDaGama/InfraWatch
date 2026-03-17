-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'http',
    "snmp_community" TEXT DEFAULT 'public',
    "snmp_oid" TEXT DEFAULT '1.3.6.1.2.1.1.1.0',
    "snmp_port" INTEGER DEFAULT 161,
    "sla_target" DOUBLE PRECISION DEFAULT 99.0,
    "criticality" TEXT DEFAULT 'medium',
    "check_interval_seconds" INTEGER DEFAULT 60,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "response_time" DOUBLE PRECISION,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_violations" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "violation_type" VARCHAR(50) NOT NULL,
    "actual_uptime" DOUBLE PRECISION NOT NULL,
    "sla_target" DOUBLE PRECISION NOT NULL,
    "period_start_at" TIMESTAMP(3) NOT NULL,
    "period_end_at" TIMESTAMP(3) NOT NULL,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_url_key" ON "devices"("url");

-- CreateIndex
CREATE INDEX "metrics_device_id_idx" ON "metrics"("device_id");

-- CreateIndex
CREATE INDEX "metrics_checked_at_idx" ON "metrics"("checked_at");

-- CreateIndex
CREATE INDEX "metrics_device_id_checked_at_idx" ON "metrics"("device_id", "checked_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sla_violations_device_id_idx" ON "sla_violations"("device_id");

-- CreateIndex
CREATE INDEX "sla_violations_created_at_idx" ON "sla_violations"("created_at");

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
