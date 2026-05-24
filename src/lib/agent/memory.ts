/**
 * Conversation memory for the LINE chat agent.
 *
 * History is keyed by lineUserId and capped to the last `MAX_TURNS` turns
 * (one turn = user + assistant pair). Older messages are still in the DB
 * for audit, but only the recent window is fed to Claude.
 *
 * Reset behavior: when a customer types "reset" / "เริ่มใหม่", the webhook
 * calls `recordReset(lineUserId)` which inserts a `[RESET]` system marker.
 * On the next `loadHistory()` call, only messages NEWER than the latest
 * reset are loaded — so Claude starts the conversation fresh.
 */
import { prisma } from "@/lib/prisma";

const MAX_TURNS = 10;   // user+assistant pairs = ~20 rows max
const MAX_ROWS  = MAX_TURNS * 2;

const RESET_MARKER             = "[RESET]";
const HANDOFF_REQUESTED_MARKER = "[HANDOFF_REQUESTED]";

export interface HistoryMessage {
  role:    "user" | "assistant";
  content: string;
}

/**
 * Load up to MAX_ROWS most recent user/assistant messages for a user,
 * filtering out anything before the last reset marker.
 * Returns them in chronological (oldest → newest) order, ready to feed
 * straight into Anthropic's `messages` array.
 */
export async function loadHistory(lineUserId: string): Promise<HistoryMessage[]> {
  // Latest reset marker (if any).
  const reset = await prisma.chatMessage.findFirst({
    where:   { lineUserId, role: "system", content: RESET_MARKER },
    orderBy: { createdAt: "desc" },
    select:  { createdAt: true },
  });

  const rows = await prisma.chatMessage.findMany({
    where: {
      lineUserId,
      role: { in: ["user", "assistant"] },
      ...(reset ? { createdAt: { gt: reset.createdAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    MAX_ROWS,
    select:  { role: true, content: true },
  });

  // We fetched newest-first to enforce the cap; flip to chronological for Claude.
  return rows.reverse().map(r => ({
    role:    r.role as "user" | "assistant",
    content: r.content,
  }));
}


/** Persist one full turn: the user's message + the agent's reply. */
export async function saveTurn(args: {
  lineUserId: string;
  userText:   string;
  agentText:  string;
  toolsUsed:  string[];
}): Promise<void> {
  await prisma.chatMessage.createMany({
    data: [
      { lineUserId: args.lineUserId, role: "user",      content: args.userText },
      { lineUserId: args.lineUserId, role: "assistant", content: args.agentText,
        toolsUsed: args.toolsUsed.length > 0 ? args.toolsUsed.join(",") : null },
    ],
  });
}


/** Mark the current conversation as reset — next loadHistory returns empty. */
export async function recordReset(lineUserId: string): Promise<void> {
  await prisma.chatMessage.create({
    data: { lineUserId, role: "system", content: RESET_MARKER },
  });
}


/** Log a handoff request — for audit / staff alerts. */
export async function recordHandoffRequest(lineUserId: string, lastMessage: string): Promise<void> {
  await prisma.chatMessage.create({
    data: { lineUserId, role: "system", content: `${HANDOFF_REQUESTED_MARKER} ${lastMessage.slice(0, 200)}` },
  });
}
