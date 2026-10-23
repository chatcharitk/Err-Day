-- AI reply inbox: threads, messages, drafts
CREATE TABLE "InboxThread" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "customerId" TEXT,
    "displayName" TEXT,
    "pictureUrl" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "unread" INTEGER NOT NULL DEFAULT 0,
    "replyToken" TEXT,
    "replyTokenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxThread_channel_externalUserId_key" ON "InboxThread"("channel", "externalUserId");
CREATE INDEX "InboxThread_lastMessageAt_idx" ON "InboxThread"("lastMessageAt");
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "externalId" TEXT,
    "sentBy" TEXT,
    "draftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxMessage_externalId_key" ON "InboxMessage"("externalId");
CREATE INDEX "InboxMessage_threadId_createdAt_idx" ON "InboxMessage"("threadId", "createdAt");
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InboxDraft" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "forMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bubbles" JSONB,
    "note" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InboxDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InboxDraft_threadId_createdAt_idx" ON "InboxDraft"("threadId", "createdAt");
ALTER TABLE "InboxDraft" ADD CONSTRAINT "InboxDraft_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
