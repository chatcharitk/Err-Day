-- AI agent conversation history per lineUserId. Powers multi-turn context
-- on the LINE chatbot.

CREATE TABLE "ChatMessage" (
    "id"         TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "role"       TEXT NOT NULL,         -- user | assistant | system
    "content"    TEXT NOT NULL,
    "toolsUsed"  TEXT,                  -- CSV of tool names (assistant rows only)
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_lineUserId_createdAt_idx" ON "ChatMessage"("lineUserId", "createdAt");
