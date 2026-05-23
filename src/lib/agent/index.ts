/**
 * err.day customer AI agent.
 *
 * Entry point: `runAgent(userMessage)` returns a single text response suitable
 * for sending back via LINE replyText. Internally it calls Claude with the
 * tool registry; if Claude wants to use a tool, we execute it and loop until
 * Claude produces a final text reply (max 5 iterations as a safety cap).
 *
 * Phase 2: read-only, one tool. The system prompt is intentionally narrow so
 * Claude doesn't promise things we haven't built (bookings, cancellations).
 */
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFS, executeTool } from "./tools";

// Sonnet 4.5 — fast, good Thai handling, cheap enough for chat traffic.
// Override via env if needed later (e.g. swap to Haiku for cost, Opus for quality).
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

// Max iterations of the tool-use loop. Phase 2 has one simple tool so this
// should never approach the cap, but it's a runaway-cost safeguard.
const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `คุณคือผู้ช่วย AI ของร้านทำผม err.day (เออร์ เดย์) ในประเทศไทย

**สไตล์การตอบ:**
- ตอบเป็นภาษาไทยที่สุภาพและเป็นมิตร ใช้คำลงท้าย "ค่ะ"
- กระชับและตรงประเด็น — เหมาะกับการอ่านบนหน้าจอ LINE (ไม่ควรเกิน 4-5 บรรทัด)
- ใช้อิโมจิเหมาะสม 🌸 ✨ 📅 📍 แต่ไม่มากเกินไป
- ขึ้นต้นด้วย "สวัสดีค่ะ" ในข้อความแรก ไม่ต้องซ้ำในข้อความถัดไป

**สิ่งที่คุณช่วยลูกค้าได้ตอนนี้:**
- บอกข้อมูลสาขา (ที่อยู่ เบอร์โทร เวลาเปิด-ปิด)

**สิ่งที่คุณยังช่วยไม่ได้ (อยู่ระหว่างพัฒนา):**
- ดูบริการและราคา
- ตรวจสอบคิวว่าง / จองคิว
- ดูการจองของลูกค้า
- ตรวจสอบสถานะสมาชิก
หากลูกค้าถามเรื่องเหล่านี้ ให้แนะนำลิงก์ https://err-day.vercel.app/book สำหรับจอง หรือบอกให้รอทีมงานตอบกลับ

**กฎ:**
- ห้ามแต่งข้อมูลที่ไม่มีในเครื่องมือ
- ถ้าไม่แน่ใจ ให้บอกว่าจะส่งต่อให้ทีมงานตอบ
- ห้ามรับยืนยันการจองหรือเปลี่ยนแปลงใดๆ — คุณยังทำไม่ได้

วันนี้: ${new Date().toLocaleDateString("th-TH", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  timeZone: "Asia/Bangkok",
})}`;


export interface AgentResult {
  text:       string;
  toolsUsed:  string[];
  iterations: number;
}

export async function runAgent(userMessage: string): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  // Conversation log — we append assistant + tool_result messages as the loop runs.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const toolsUsed: string[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 512,
      system:     SYSTEM_PROMPT,
      tools:      TOOL_DEFS,
      messages,
    });

    // If Claude produced a final text reply, we're done.
    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = extractText(response.content);
      return { text: text || "ขออภัยค่ะ ระบบขัดข้องชั่วคราว", toolsUsed, iterations: i + 1 };
    }

    // If Claude wants to use tools, execute them and append the results.
    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      // Persist Claude's turn (text + tool_use blocks) before adding results.
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (block) => {
          toolsUsed.push(block.name);
          try {
            const { result } = await executeTool(block.name, block.input);
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          } catch (e) {
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ error: e instanceof Error ? e.message : "tool failed" }),
              is_error: true,
            };
          }
        }),
      );
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — bail with whatever text we have.
    const text = extractText(response.content);
    return {
      text: text || "ขออภัยค่ะ ลองอีกครั้งหรือพิมพ์ข้อความใหม่นะคะ",
      toolsUsed,
      iterations: i + 1,
    };
  }

  // Hit the iteration cap — safety bailout.
  return {
    text: "ขออภัยค่ะ ระบบใช้เวลาประมวลผลนานเกินไป กรุณาลองพิมพ์คำถามอีกครั้งนะคะ",
    toolsUsed,
    iterations: MAX_ITERATIONS,
  };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim();
}
