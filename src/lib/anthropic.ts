/**
 * Anthropic API access. The key may be a personal (user-scoped) key, which
 * needs the workspace id on every request — set ANTHROPIC_WORKSPACE_ID then.
 */
export function anthropicHeaders(): Record<string, string> | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    ...(workspace ? { "anthropic-workspace-id": workspace } : {}),
  };
}
