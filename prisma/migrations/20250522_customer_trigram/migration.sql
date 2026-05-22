-- Speed up the customer search dropdown (AddBookingModal, NewBookingForm,
-- POS terminal). The search uses ILIKE '%q%' on name, nickname and phone,
-- which can only use a btree index for prefix matches — wildcards on both
-- sides forced a full table scan.
--
-- pg_trgm + GIN indexes on these columns make wildcard ILIKE queries fast
-- regardless of where the match occurs in the string.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Customer_name_trgm_idx"     ON "Customer" USING GIN ("name"     gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_nickname_trgm_idx" ON "Customer" USING GIN ("nickname" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_phone_trgm_idx"    ON "Customer" USING GIN ("phone"    gin_trgm_ops);
