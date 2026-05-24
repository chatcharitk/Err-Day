/**
 * PRODUCTION LINE webhook — @err.day Messaging API channel.
 *
 * SILENT MODE (current): the webhook does NOT send any auto-reply to
 * customer messages. The reasoning is that any visible bot message reveals
 * "we're using AI" — which the salon wants to keep hidden during the
 * private beta on the test channel.
 *
 * What this webhook DOES do:
 *   - Verify LINE signature (when LINE_CHANNEL_SECRET is set)
 *   - Capture lineUserId → displayName into NotificationLog so admin can
 *     send staff alerts (internal, invisible to customers)
 *   - Return 200 quickly so LINE doesn't retry
 *
 * What it does NOT do:
 *   - Auto-reply to text messages (silent mode)
 *   - Call the AI agent
 *   - Send any push messages
 *
 * Staff continue to reply manually via the @err.day LINE OA chat interface.
 *
 * When you're ready to expose the agent to real customers, replace
 * `buildReply: silent` below with the agent call — see the test webhook at
 * /api/line/webhook-test for the full implementation pattern.
 */
import { createLineWebhookHandler } from "@/lib/line-webhook";

// Return null = "do not reply" — handler skips the LINE Reply API call.
const silent = async () => null;

export const POST = createLineWebhookHandler({
  label:         "prod",
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  accessToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN,
  buildReply:    silent,
});
