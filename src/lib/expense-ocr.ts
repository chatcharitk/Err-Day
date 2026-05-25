/**
 * Invoice OCR for the Expense module.
 *
 * Sends a receipt/invoice image to Claude's vision model, which extracts
 * structured data the admin can review + edit before saving.
 *
 * - INTERNAL admin tool only (not customer-facing)
 * - Returns a best-effort guess; admin always confirms before save
 * - Costs ~$0.01–0.03 per invoice depending on image size
 */
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./expenses";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export interface ParsedInvoice {
  vendor:        string | null;
  /** YYYY-MM-DD, Bangkok local. */
  date:          string | null;
  /** Total amount in BAHT (not satang — easier for the UI). */
  totalAmount:   number | null;
  vatAmount:     number | null;
  paymentMethod: string | null;  // CASH | TRANSFER | CARD | OTHER
  category:      string | null;  // see EXPENSE_CATEGORIES values
  items:         ParsedInvoiceItem[];
  notes:         string | null;
}
export interface ParsedInvoiceItem {
  description: string;
  quantity:    number;
  unitPrice:   number;  // baht per unit
  totalPrice:  number;  // baht
}

const SYSTEM_PROMPT = `คุณคือ AI ช่วยอ่านใบกำกับภาษี/ใบเสร็จของร้านทำผมไทย (err.day Salon)

หน้าที่: ดูภาพใบกำกับภาษี/ใบเสร็จที่ส่งมา แล้วดึงข้อมูลออกมาเป็น JSON ตามรูปแบบที่กำหนด

หมวดหมู่ค่าใช้จ่ายที่ใช้ได้ (เลือก 1 ค่าที่ใกล้เคียงที่สุด):
${EXPENSE_CATEGORIES.map(c => `  - ${c.value}: ${c.label}`).join("\n")}

วิธีจ่ายเงินที่ใช้ได้:
${PAYMENT_METHODS.map(p => `  - ${p.value}: ${p.label}`).join("\n")}

กฎ:
- หากอ่านข้อมูลใดไม่ออก / ไม่แน่ใจ ให้ตอบ null
- จำนวนเงินทั้งหมดให้ตอบเป็น "บาท" (Number, ไม่ใส่จุลภาค ไม่ใส่หน่วย)
- วันที่ในรูปแบบ YYYY-MM-DD
- ถ้าใบเสร็จมีหลายรายการ ให้ใส่ใน items[]
- ถ้าเดาหมวดหมู่ไม่ได้ ให้ตอบ "other"
- ไม่ต้องอธิบายเหตุผล — ตอบเฉพาะ JSON ตามรูปแบบ`;

const TOOL_DEF: Anthropic.Tool = {
  name: "submit_invoice_data",
  description: "Submit the extracted invoice data after reading the image. Use null for fields you cannot read with confidence.",
  input_schema: {
    type: "object",
    properties: {
      vendor:        { type: ["string", "null"], description: "Supplier / shop name. Thai or English." },
      date:          { type: ["string", "null"], description: "Invoice date in YYYY-MM-DD format." },
      totalAmount:   { type: ["number", "null"], description: "Total amount in THB (baht, not satang)." },
      vatAmount:     { type: ["number", "null"], description: "VAT amount in THB. null if no VAT line." },
      paymentMethod: { type: ["string", "null"], enum: [...PAYMENT_METHODS.map(p => p.value), null], description: "One of: CASH, TRANSFER, CARD, OTHER. null if unknown." },
      category:      { type: ["string", "null"], enum: [...EXPENSE_CATEGORIES.map(c => c.value), null], description: "Best-guess category from the predefined list." },
      items: {
        type: "array",
        description: "Line items from the invoice. Empty array if no per-line breakdown.",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity:    { type: "number" },
            unitPrice:   { type: "number", description: "THB per unit." },
            totalPrice:  { type: "number", description: "THB line total." },
          },
          required: ["description", "quantity", "unitPrice", "totalPrice"],
        },
      },
      notes: { type: ["string", "null"], description: "Anything notable: payment terms, branch reference, etc." },
    },
    required: ["vendor", "date", "totalAmount", "vatAmount", "paymentMethod", "category", "items", "notes"],
  },
};


/**
 * Parse an invoice image (PNG / JPEG / WebP) into structured expense fields.
 * Throws if ANTHROPIC_API_KEY is missing or Claude returns garbage.
 *
 * @param imageBase64 — base64-encoded image bytes (no data: prefix)
 * @param mediaType   — "image/jpeg" | "image/png" | "image/webp" | "image/gif"
 */
export async function parseInvoiceImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<ParsedInvoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    tools:      [TOOL_DEF],
    tool_choice: { type: "tool", name: "submit_invoice_data" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "นี่คือใบกำกับภาษี/ใบเสร็จของร้านทำผม err.day กรุณาดึงข้อมูลและส่งผ่าน submit_invoice_data tool",
          },
        ],
      },
    ],
  });

  // tool_choice forces a tool_use block — extract it.
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_invoice_data",
  );
  if (!toolUse) throw new Error("Claude did not return invoice data");

  return toolUse.input as ParsedInvoice;
}
