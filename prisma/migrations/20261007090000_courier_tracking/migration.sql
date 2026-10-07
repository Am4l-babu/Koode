-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN "courier" TEXT,
ADD COLUMN "courierName" TEXT,
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "trackingAddedAt" TIMESTAMP(3);
