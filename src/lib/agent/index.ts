/**
 * err.day customer AI agent (Phase 3).
 *
 * Entry point: `runAgent({ userMessage, lineUserId? })` returns a single text
 * response suitable for sending back via LINE replyText.
 *
 * Internally it calls Claude with the tool registry; if Claude wants to use
 * a tool, we execute it (with the per-user context) and loop until Claude
 * produces a final text reply. Safety cap of 5 iterations against runaway cost.
 *
 * Phase 3: 5 read-only tools — lookup_branches, lookup_services,
 * check_availability, lookup_my_bookings, check_membership_status.
 */
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFS, executeTool, type ToolContext } from "./tools";

const MODEL          = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const MAX_ITERATIONS = 5;
const MAX_TOKENS     = 800;


function buildSystemPrompt(ctx: ToolContext): string {
  const todayThai = new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const todayIso = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const userContext = ctx.lineUserId
    ? "ผู้ใช้ปัจจุบันได้เชื่อม LINE แล้ว — สามารถดูการจองและสมาชิกของตัวเองได้ผ่านเครื่องมือ lookup_my_bookings และ check_membership_status"
    : "ผู้ใช้ปัจจุบันยังไม่ได้เชื่อม LINE — เครื่องมือเฉพาะตัว (การจองของฉัน, สถานะสมาชิก) จะใช้ไม่ได้";

  return `คุณคือผู้ช่วย AI ของร้านทำผม err.day (เออร์ เดย์) ในประเทศไทย

**สไตล์การตอบ:**
- ตอบเป็นภาษาไทยที่สุภาพและเป็นมิตร ใช้คำลงท้าย "ค่ะ"
- กระชับและตรงประเด็น — เหมาะกับการอ่านบนหน้าจอ LINE (4-6 บรรทัด, รายการให้แบ่งบรรทัดอ่านง่าย)
- ใช้อิโมจิเหมาะสม 🌸 ✨ 📅 📍 💇 แต่ไม่มากเกินไป
- ขึ้นต้นด้วย "สวัสดีค่ะ" ในข้อความแรก ไม่ต้องซ้ำในข้อความถัดไป

**สิ่งที่คุณช่วยลูกค้าได้:**
- บอกข้อมูลสาขา (lookup_branches)
- บอกบริการและราคา (lookup_services)
- ตรวจสอบคิวว่างในแต่ละวัน (check_availability)
- ดูการจองของลูกค้าเอง (lookup_my_bookings)
- ตรวจสอบสถานะสมาชิก (check_membership_status)

**สิ่งที่คุณยังทำไม่ได้:**
- จองคิวให้ — แนะนำลิงก์ https://err-day.vercel.app/book
- ยกเลิก / เปลี่ยนแปลงการจอง — แจ้งให้รอทีมงาน หรือทักแชทแอดมินโดยตรง
- สมัครสมาชิก / ต่ออายุ — แนะนำลิงก์ https://err-day.vercel.app/membership

**กฎสำคัญ:**
- ใช้เครื่องมือเพื่อดึงข้อมูลจริงเสมอ — ห้ามแต่งราคา เวลา หรือข้อมูลที่ไม่มี
- เมื่อลูกค้าถามคิวว่าง: ถ้าไม่แน่ใจ duration ของบริการ ให้เรียก lookup_services ก่อน
- เมื่อลูกค้าถามวัน (พรุ่งนี้, วันเสาร์ ฯลฯ) ให้คำนวณเป็น YYYY-MM-DD ก่อนเรียกเครื่องมือ
- ถ้าเครื่องมือคืนค่า error ให้แจ้งลูกค้าและเสนอทางออก (เช่น ลองวันอื่น, ติดต่อแอดมิน)
- ห้ามให้ข้อมูลของลูกค้าคนอื่น — เครื่องมือเฉพาะตัวจะคืนเฉพาะข้อมูลของผู้ส่งข้อความเท่านั้น
- ถ้าไม่แน่ใจ ให้บอกตรงๆ และเสนอติดต่อทีมงาน

**ข้อมูลปัจจุบัน:**
- วันนี้: ${todayThai} (รูปแบบ YYYY-MM-DD: ${todayIso})
- เขตเวลา: Asia/Bangkok (UTC+7)
- ${userContext}`;
}


export interface AgentInput {
  userMessage: string;
  lineUserId?: string;
}

export interface AgentResult {
  text:       string;
  toolsUsed:  string[];
  iterations: number;
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { lineUserId: input.lineUserId };
  const system = buildSystemPrompt(ctx);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: input.userMessage },
  ];
  const toolsUsed: string[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools:      TOOL_DEFS,
      messages,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = extractText(response.content);
      return { text: text || "ขออภัยค่ะ ระบบขัดข้องชั่วคราว", toolsUsed, iterations: i + 1 };
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (block) => {
          toolsUsed.push(block.name);
          try {
            const { result } = await executeTool(block.name, block.input, ctx);
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          } catch (e) {
            console.error(`[agent] tool ${block.name} failed:`, e);
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

    const text = extractText(response.content);
    return {
      text: text || "ขออภัยค่ะ ลองอีกครั้งหรือพิมพ์ข้อความใหม่นะคะ",
      toolsUsed,
      iterations: i + 1,
    };
  }

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
