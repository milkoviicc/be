-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bestStreakDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreakDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastStreakDate" TIMESTAMP(3),
ADD COLUMN     "monthlyHousingCost" DECIMAL(14,2),
ADD COLUMN     "monthlyNetIncome" DECIMAL(14,2),
ADD COLUMN     "monthlyOtherFixedCosts" DECIMAL(14,2),
ADD COLUMN     "monthlyUtilitiesCost" DECIMAL(14,2),
ALTER COLUMN "username" DROP DEFAULT,
ALTER COLUMN "firstName" DROP DEFAULT,
ALTER COLUMN "lastName" DROP DEFAULT;
