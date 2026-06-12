/**
 * LINE group chat IDs per branch.
 *
 * The bot (ERR•DAY OA) is a member of one LINE group per branch. To push to a
 * group we need its `groupId` (a "C..." id). Set these via env once captured:
 *   LINE_GROUP_SUKHUMVIT = C....
 *   LINE_GROUP_BANGNA    = C....
 *
 * To capture a group's id: in the group, send the message "groupid" — the
 * webhook replies with the id (see /api/line/webhook).
 */
export function branchGroupId(branchId: string): string | undefined {
  const map: Record<string, string | undefined> = {
    "branch-sukhumvit": process.env.LINE_GROUP_SUKHUMVIT,
    "branch-bangna":    process.env.LINE_GROUP_BANGNA,
  };
  return map[branchId]?.trim() || undefined;
}

/** All branch ids that currently have a configured group (for the daily cron). */
export function branchesWithGroups(): string[] {
  return ["branch-sukhumvit", "branch-bangna"].filter(id => !!branchGroupId(id));
}

/**
 * Reverse lookup: which branch does a LINE group belong to?
 * Used by the webhook to attribute payment slips posted in a branch group.
 * Returns undefined for unknown groups (e.g. other chats the OA is in).
 */
export function branchIdForGroup(groupId: string): string | undefined {
  return branchesWithGroups().find(id => branchGroupId(id) === groupId);
}
