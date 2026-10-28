ALTER TABLE "InboxDraft" ADD COLUMN "trace" JSONB;
ALTER TABLE "InboxDraft" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "InboxDraft" ADD COLUMN "feedback" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InboxDraft" ADD COLUMN "feedbackNote" TEXT;
ALTER TABLE "InboxDraft" ADD COLUMN "feedbackAt" TIMESTAMP(3);

CREATE TABLE "InboxPromptText" (
  "hash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxPromptText_pkey" PRIMARY KEY ("hash")
);
