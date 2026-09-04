-- A membership row may be created when a customer submits the app form, but
-- registration alone must never grant member status. Make pending the safe
-- default for every future bare insert; POS/admin activation explicitly writes
-- false after payment is recorded.
ALTER TABLE "Membership"
  ALTER COLUMN "pendingActivation" SET DEFAULT true;

-- Repair self-signups that the old booking flow auto-activated even though no
-- MembershipCycle (our payment/activation record) exists. Preserve legitimate
-- POS and manual memberships, both of which have a cycle.
UPDATE "Membership" AS m
SET
  "pendingActivation" = true,
  "expiresAt" = NULL,
  "usagesUsed" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Customer" AS c
WHERE c.id = m."customerId"
  AND c."pdpaSource" = 'liff-membership'
  AND m."pendingActivation" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "MembershipCycle" AS mc
    WHERE mc."membershipId" = m.id
  );

-- These booking flags came from the same incorrect auto-activation. They are
-- informational only, but clearing them keeps admin history truthful.
UPDATE "Booking" AS b
SET "activatesMembership" = false
WHERE b."activatesMembership" = true
  AND EXISTS (
    SELECT 1
    FROM "Customer" AS c
    JOIN "Membership" AS m ON m."customerId" = c.id
    WHERE c.id = b."customerId"
      AND c."pdpaSource" = 'liff-membership'
      AND m."pendingActivation" = true
      AND NOT EXISTS (
        SELECT 1
        FROM "MembershipCycle" AS mc
        WHERE mc."membershipId" = m.id
      )
  );
