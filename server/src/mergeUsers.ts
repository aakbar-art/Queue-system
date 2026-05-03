/**
 * When the client POSTs a full QueueState, plain-text passwords are often omitted.
 * Re-attach passwordHash from the previous snapshot by stable user id.
 */
export function mergeUserPasswordHashes(
  incoming: Record<string, unknown>,
  prev: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!prev || !Array.isArray(prev.users) || !Array.isArray((incoming as { users?: unknown }).users)) {
    return incoming;
  }
  const prevUsers = prev.users as { id: string; passwordHash?: string }[];
  const map = new Map(prevUsers.map((u) => [u.id, u.passwordHash]));
  const next = JSON.parse(JSON.stringify(incoming)) as {
    users: { id: string; password?: string; passwordHash?: string }[];
  };
  for (const u of next.users) {
    if (!u.password && map.get(u.id)) {
      u.passwordHash = map.get(u.id);
      delete u.password;
    }
  }
  return next;
}
