/*
  Warnings:

  - You are about to drop the column `userId` on the `Prediction` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ShareCard` table. All the data in the column will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkyLogEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_userId_fkey";

-- DropForeignKey
ALTER TABLE "Prediction" DROP CONSTRAINT "Prediction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShareCard" DROP CONSTRAINT "ShareCard_userId_fkey";

-- DropForeignKey
ALTER TABLE "SkyLogEntry" DROP CONSTRAINT "SkyLogEntry_userId_fkey";

-- DropIndex
DROP INDEX "Prediction_userId_idx";

-- DropIndex
DROP INDEX "ShareCard_userId_idx";

-- AlterTable
ALTER TABLE "Prediction" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "ShareCard" DROP COLUMN "userId";

-- DropTable
DROP TABLE "Location";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "SkyLogEntry";

-- DropTable
DROP TABLE "User";
