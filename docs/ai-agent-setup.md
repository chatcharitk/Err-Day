# err.day AI Agent — Setup Guide

This is the rollout plan for the LINE chatbot AI agent that answers customer questions on LINE OA.

## Status

- ✅ **Phase 1**: Webhook receives messages, sends a stub reply.
- ✅ **Phase 1b**: Test channel architecture — separate sandbox OA.
- ✅ **Phase 2**: Claude API + first read-only tool (`lookup_branches`) on the test channel, gated by allowlist.
- ✅ **Phase 3**: All five read-only tools — branches, services, availability, my-bookings, membership.
- ✅ **Phase 4**: Conversation memory, rate limiting, reset/handoff commands. (THIS COMMIT)
- ⏳ Phase 5: Promote agent to the production channel.

## Phase 4 features

### Multi-turn memory
Conversation history per `lineUserId` is persisted in the `ChatMessage` table. The agent loads the last ~10 turns on every message, so it can answer follow-ups naturally:

> You: ร้านอยู่ที่ไหน?
> Agent: สาขาสุขุมวิท และบางนาค่ะ ✨
> You: บางนาเปิดกี่โมง?    ← Agent knows you mean Bangna

### Rate limiting
Backed by database row count, not in-memory (survives Vercel cold starts):
- **5 messages per minute** per user → polite cooldown message
- **100 messages per day** per user → polite "come back tomorrow"

### Special commands

| Type | Reply |
|---|---|
| `reset` / `เริ่มใหม่` / `ล้าง` | Clears conversation history (inserts a `[RESET]` marker; older messages excluded from next load) |
| `ติดต่อแอดมิน` / `พูดกับคน` / `human` | Logs a handoff request; pauses agent for that turn; gives the customer the salon phone numbers |
| `myid` | Echoes the sender's LINE userId (utility for allowlisting) |

## Channel layout

| Channel | Webhook URL | Env vars | Who sees it |
|---|---|---|---|
| **Production** @err.day | `/api/line/webhook` | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | Real customers |
| **Test** @err.day-test | `/api/line/webhook-test` | `LINE_CHANNEL_SECRET_TEST`, `LINE_CHANNEL_ACCESS_TOKEN_TEST` | Only people you add as friends |

Both webhooks share the same Next.js deployment but read different env vars. Experimental code lands on the test webhook first; once it works there, promote to production.

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

---

## Set up the TEST channel (do this before Phase 2)

### 1. Create the test LINE Messaging API channel

1. [LINE Developers Console](https://developers.line.biz/) → your provider → **Create a new channel** → **Messaging API**
2. Channel name: `err.day [TEST]` (or whatever you want — only you see it)
3. Category, subcategory, description: any values, doesn't matter
4. Once created → **Basic settings** tab → copy the **Channel secret**
5. → **Messaging API** tab → scroll to **Channel access token** → **Issue** (long-lived) → copy the token

### 2. Add to Vercel env vars

```
LINE_CHANNEL_SECRET_TEST=<test channel secret>
LINE_CHANNEL_ACCESS_TOKEN_TEST=<test channel access token>
```

For all environments (Production, Preview, Development).

### 3. Configure the test channel's webhook

In the test channel's **Messaging API** tab:
- **Webhook URL**: `https://err-day.vercel.app/api/line/webhook-test`
- **Use webhook**: ON → click **Verify** (should be ✓)
- **Auto-reply messages**: OFF

### 4. Add the test OA as a friend

In the **Messaging API** tab → scroll to **QR code** → scan with your LINE app. You're now friends with the test OA.

### 5. Smoke-test

Send any text message to the test OA. You should get back:

> 🧪 [TEST CHANNEL] สวัสดีค่ะ
> นี่คือช่องทดสอบของ err.day — กำลังเตรียม AI ผู้ช่วย
> ...
> — ข้อความที่ได้รับ —
> "<your message echoed back>"

If you see your message echoed, the test channel is wired up correctly.

---

## Phase 2 setup (just shipped)

### Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) → sign up (free)
2. **Settings → API Keys** → create a new key → copy it (starts with `sk-ant-`)
3. **Top up billing** with at least $5 — Claude doesn't have a free tier; pay-as-you-go from your balance

### Add to Vercel env

```
ANTHROPIC_API_KEY=sk-ant-...
LINE_USER_ID_TEST=Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # see below
```

For the `LINE_USER_ID_TEST` value, do this:
1. With the test webhook deployed, send the text **`myid`** to the test OA
2. The bot replies with your LINE userId (`Uxxxxxx...`, 33 chars)
3. Paste that exact string as `LINE_USER_ID_TEST` in Vercel
4. (Optional) comma-separate multiple IDs if you want to grant access to a teammate: `Uxxx...,Uyyy...`
5. Redeploy

### How Phase 2 behaves

| Sender | Reply |
|---|---|
| You (in allowlist) | Claude's AI response (uses `lookup_branches` when relevant) |
| Anyone else | The standard stub (safe fallback) |
| Anyone who sends "myid" | Their own LINE userId echoed back |

### Test prompts to try (Phase 3 — 5 tools)

| Prompt | Tools Claude should use | Expected behavior |
|---|---|---|
| "ร้านอยู่ที่ไหน?" | lookup_branches | Lists both branches with address + phone |
| "มีบริการอะไรบ้างที่สาขาสุขุมวิท?" | lookup_branches → lookup_services | Lists services with prices + durations |
| "สระไดร์ราคาเท่าไหร่?" | lookup_branches → lookup_services | Returns 350 baht (100 member) |
| "พรุ่งนี้สระไดร์ว่ามั้ย?" | lookup_branches → lookup_services → check_availability | Returns available time slots |
| "วันเสาร์มีคิว 13:00 มั้ย สาขาบางนา?" | lookup_branches → check_availability | Yes/no with available alternatives |
| "ฉันมีนัดเมื่อไหร่?" | lookup_my_bookings | List of upcoming bookings or "no bookings" |
| "ฉันเป็นสมาชิกอยู่มั้ย?" | check_membership_status | Active/expired + expiry date |
| "ขอเปลี่ยนเวลานัด" | (no tool) | Explains it can't change bookings, suggests LINE chat with admin |
| "myid" | (no tool, special command) | Echoes the sender's LINE userId |

### Privacy

- Per-user tools (`lookup_my_bookings`, `check_membership_status`) **never expose other people's data**. The LINE userId is injected from the webhook into the agent context — Claude can't override it.
- Bookings are filtered to the sender's customer record (matched by `lineUserId`).
- Customers who've never linked LINE (no `lineUserId` on their `Customer` row) get a polite "please book once via the web to link your account" response.

### Cost

- **Model**: `claude-sonnet-4-5` (~$3 input / $15 output per million tokens)
- **Per message**: ~$0.003 simple, ~$0.01 with tool use
- **Estimated at 100 messages/day**: ~$30/month
- Set spending limits in Anthropic Console under Billing.

---

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
