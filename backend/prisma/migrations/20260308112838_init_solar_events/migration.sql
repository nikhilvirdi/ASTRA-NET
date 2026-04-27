-- CreateTable
CREATE TABLE "SolarEvent" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'ADITYA',
    "eventType" TEXT NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "rawData" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolarEvent_timestamp_idx" ON "SolarEvent"("timestamp" DESC);
