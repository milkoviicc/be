-- AlterTable: replace name with username, firstName, lastName
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" ADD COLUMN "username" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
