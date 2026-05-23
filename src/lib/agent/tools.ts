/**
 * Tool definitions for the err.day AI customer agent.
 *
 * Each tool is a pair: the schema Claude sees (name, description, input_schema)
 * and the local implementation that runs the actual Prisma query.
 *
 * Phase 2: one read-only tool — lookup_branches.
 * Future phases will add: lookup_services, check_availability,
 * lookup_my_bookings, check_membership_status.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Anthropic SDK exposes Tool from messages namespace. Inline-define here so
// we don't import deep paths.
export type ToolDef = Anthropic.Tool;
export type ToolResult = { name: string; result: unknown };


// ── Tool: lookup_branches ─────────────────────────────────────────────────────

const LOOKUP_BRANCHES: ToolDef = {
  name: "lookup_branches",
  description:
    "List all currently-open err.day salon branches with their name, address, " +
    "phone number, and daily open/close hours. Use this when the customer asks " +
    "where the salon is, what branches exist, what the hours are, or for any " +
    "address/contact information.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

async function runLookupBranches() {
  // name desc: ส (สุขุมวิท) before บ (บางนา) — consistent with the booking page.
  const branches = await prisma.branch.findMany({
    where: { isActive: true, bookingEnabled: true },
    orderBy: [{ name: "desc" }],
    select: {
      name: true, address: true, phone: true,
      openTime: true, closeTime: true,
    },
  });

  return branches.map(b => ({
    name:    b.name,
    address: b.address,
    phone:   b.phone,
    // Sundays open later (10:00) than weekdays; weekday open uses branch.openTime.
    hours_mon_sat: `${b.openTime ?? "08:00"}–${b.closeTime ?? "21:00"}`,
    hours_sunday:  `10:00–${b.closeTime ?? "21:00"}`,
  }));
}


// ── Registry ─────────────────────────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [LOOKUP_BRANCHES];

export async function executeTool(name: string, _input: unknown): Promise<ToolResult> {
  switch (name) {
    case "lookup_branches":
      return { name, result: await runLookupBranches() };
    default:
      return { name, result: { error: `unknown tool: ${name}` } };
  }
}
