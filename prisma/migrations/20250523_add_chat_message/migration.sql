-- Recreated locally 2026-06-12: this migration was applied to the database on
-- 2025-05-23 but its folder was missing from the repo, which made
-- `prisma migrate dev` flag drift and offer a reset. Content reconstructed to
-- match the live ChatMessage table; `migrate deploy` skips it (already applied).

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolsUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_lineUserId_createdAt_idx" ON "ChatMessage"("lineUserId", "createdAt");
