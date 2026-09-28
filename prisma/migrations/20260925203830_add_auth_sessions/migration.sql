-- AlterTable
ALTER TABLE "Analyst" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "Analyst" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Session_analystId_idx" ON "Session"("analystId");
