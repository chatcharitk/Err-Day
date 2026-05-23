# err.day AI Agent — Setup Guide

This is the rollout plan for the LINE chatbot AI agent that answers customer questions on LINE OA.

## Status

- ✅ **Phase 1**: Webhook receives messages, sends a stub reply. (THIS COMMIT)
- ⏳ Phase 2: Connect Claude API + first read-only tool (`lookup_branches`).
- ⏳ Phase 3: All read-only tools (services, availability, my-bookings, membership).
- ⏳ Phase 4: Conversation history, fallback to human, rate limiting.

---

## Phase 1 — what you need to do now

### 1. Get the LINE Channel Secret

The webhook now verifies LINE's `x-line-signature` header. You need to give it the secret to check against.

1. Open [LINE Developers Console](https://developers.line.biz/)
2. Pick your provider → the **err.day** Messaging API channel
3. Tab **Basic settings** → scroll to **Channel secret** → copy
4. In Vercel: **Project Settings → Environment Variables** → add:
   ```
   LINE_CHANNEL_SECRET=<paste the secret>
   ```
   for **all environments** (Production, Preview, Development)
5. Redeploy (Vercel auto-redeploys on next push)

> If you don't set this, the webhook still works (existing behavior) but logs a warning. Anyone could POST to your webhook URL and trigger fake replies — set it before going live with real customers.

### 2. Configure the webhook in LINE Console

1. Same channel → tab **Messaging API**
2. **Webhook settings**
   - Webhook URL: `https://err-day.vercel.app/api/line/webhook`
   - Use webhook: **ON**
   - Click **Verify** — should return success
3. **LINE Official Account features**
   - Auto-reply messages: **OFF** (so our agent's reply is the only one the customer sees)
   - Greeting messages: ON or OFF — your call

### 3. Test it

Send a message ("สวัสดี") to your @err.day LINE OA from a personal LINE account.
You should get the stub reply within ~1 second:

> สวัสดีค่ะ 🌸 ขอบคุณที่ติดต่อ err.day
> ขณะนี้ระบบ AI ผู้ช่วยกำลังเตรียมพร้อม
> 📅 จองคิวออนไลน์: https://err-day.vercel.app/book
> ...

If it doesn't reply:
- Check Vercel logs for `[webhook]` lines
- Confirm `LINE_CHANNEL_ACCESS_TOKEN` is set (already is)
- Confirm `LINE_CHANNEL_SECRET` is set (newly required)
- Confirm "Auto-reply messages" is OFF in LINE console (otherwise LINE intercepts first)

---

## When you're ready for Phase 2

Tell me to "build Phase 2" and I'll:
1. Install `@anthropic-ai/sdk`
2. Add `ANTHROPIC_API_KEY` to env (you create one at [console.anthropic.com](https://console.anthropic.com))
3. Wire Claude with the first tool: `lookup_branches`
4. Replace the stub reply with the agent's response

Cost estimate: ~$0.003–0.01 per customer message, depending on tool use. ~100 messages/day ≈ ~$30/month.

---

## Architecture reference

```
Customer → LINE chat → POST /api/line/webhook
                            │
                            ├─ verify x-line-signature (HMAC-SHA256)
                            ├─ capture lineUserId → displayName
                            └─ if text message:
                                  Phase 1: stub reply
                                  Phase 2+: Claude API with tools
                                           ├─ lookup_branches()
                                           ├─ lookup_services()
                                           ├─ check_availability()
                                           ├─ lookup_my_bookings(lineUserId)
                                           └─ check_membership_status(lineUserId)
                                  → replyText(replyToken, response)
```

## Security posture (Phase 1)

- ✅ HMAC signature verification (when secret is set)
- ✅ Read-only — agent cannot modify data yet
- ✅ Per-user scoping — `lookup_my_bookings(lineUserId)` only returns the sender's data (in Phase 3)
- ⚠️ No rate limiting yet — comes in Phase 4
- ⚠️ No conversation persistence — each message is independent (comes in Phase 4)
