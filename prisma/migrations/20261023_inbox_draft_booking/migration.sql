-- AI inbox: booking prepared from the chat, and the booking created from it
ALTER TABLE "InboxDraft" ADD COLUMN "booking" JSONB;
ALTER TABLE "InboxDraft" ADD COLUMN "bookingId" TEXT;
