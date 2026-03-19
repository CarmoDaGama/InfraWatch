-- CreateTable
CREATE TABLE "integration_settings" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhook_url" TEXT,
    "webhook_token" TEXT,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_provider_key" ON "integration_settings"("provider");
