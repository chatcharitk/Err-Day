/**
 * Bank-transfer slip OCR for the payment-slip pipeline.
 *
 * Same technique as expense-ocr.ts: send the slip image to Claude vision with
 * forced tool-use so the result is always structured. Slips are simpler than
 * invoices — we only need the amount (to match a booking), plus time/bank/
 * sender as display hints for the admin reviewing the match.
 *
 * - INTERNAL only (slips come from the branch staff LINE groups)
 * - Best-effort: admin always confirms before checkout
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export interface ParsedSlip {
  /** Transfer amount in BAHT (not satang). null when unreadable. */
  amount:     number | null;
  /** Transfer date in Gregorian YYYY-MM-DD (Thai slips print Buddhist Era — converted). */
  date:       string | null;
  /** Transfer time as shown on the slip, e.g. "14:36". */
  time:       string | null;
  /** Bank or app name (KBank, SCB, PromptPay…). */
  bank:       string | null;
  /** Sender name as printed on the slip — used to disambiguate bookings. */
  senderName: string | null;
}

const SYSTEM_PROMPT = `คุณคือ AI อ่านสลิปโอนเงินธนาคารไทย (เช่น K PLUS, SCB Easy, PromptPay, Krungthai NEXT)

หน้าที่: ดูภาพสลิปโอนเงิน แล้วดึงข้อมูลออกมา

กฎ:
- amount = ยอดเงินที่โอน เป็น "บาท" (Number, ไม่ใส่จุลภาค ไม่ใส่หน่วย)
- date = วันที่โอน รูปแบบ "YYYY-MM-DD" เป็นปี ค.ศ. — สลิปไทยมักแสดงปี พ.ศ. (เช่น 69 หรือ 2569) ให้แปลงเป็น ค.ศ. โดยลบ 543 (2569 → 2026)
- time = เวลาที่โอนตามที่ปรากฏบนสลิป รูปแบบ "HH:mm" (24 ชม.)
- senderName = ชื่อผู้โอน ตามที่พิมพ์บนสลิป (รวมคำนำหน้า ถ้ามี)
- ถ้าภาพไม่ใช่สลิปโอนเงิน หรืออ่านไม่ออก ให้ตอบ null ทุกช่อง
- ไม่ต้องอธิบาย — ตอบเฉพาะข้อมูลผ่าน tool`;

const TOOL_DEF: Anthropic.Tool = {
  name: "submit_slip_data",
  description: "Submit the data extracted from the bank-transfer slip. Use null for anything unreadable, or for ALL fields if the image is not a transfer slip.",
  input_schema: {
    type: "object",
    properties: {
      amount:     { type: ["number", "null"], description: "Transfer amount in THB (baht, not satang)." },
      date:       { type: ["string", "null"], description: "Transfer date, Gregorian YYYY-MM-DD. Thai slips show Buddhist Era years — subtract 543 (พ.ศ. 2569 → 2026)." },
      time:       { type: ["string", "null"], description: "Transfer time as printed, HH:mm 24h." },
      bank:       { type: ["string", "null"], description: "Bank or payment app name." },
      senderName: { type: ["string", "null"], description: "Sender name as printed on the slip, including title prefix if shown." },
    },
    required: ["amount", "date", "time", "bank", "senderName"],
  },
};

/**
 * Parse a transfer-slip image into structured fields.
 * Throws if no API key is configured or Claude returns garbage.
 *
 * @param imageBase64 — base64-encoded image bytes (no data: prefix)
 * @param mediaType   — "image/jpeg" | "image/png" | "image/webp" | "image/gif"
 */
export async function parseSlipImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<ParsedSlip> {
  const apiKey = (process.env.ANTHROPIC_API_KEY_EXPENSE?.trim()
                ?? process.env.ANTHROPIC_API_KEY?.trim());
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY_EXPENSE (or ANTHROPIC_API_KEY) is not set");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 256,
    system:     SYSTEM_PROMPT,
    tools:      [TOOL_DEF],
    tool_choice: { type: "tool", name: "submit_slip_data" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text",  text: "อ่านสลิปโอนเงินนี้" },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_slip_data",
  );
  if (!toolUse) throw new Error("slip OCR: no tool_use block in response");

  const data = toolUse.input as Record<string, unknown>;
  return {
    amount:     typeof data.amount === "number" ? data.amount : null,
    date:       typeof data.date   === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null,
    time:       typeof data.time   === "string" ? data.time   : null,
    bank:       typeof data.bank   === "string" ? data.bank   : null,
    senderName: typeof data.senderName === "string" ? data.senderName : null,
  };
}
