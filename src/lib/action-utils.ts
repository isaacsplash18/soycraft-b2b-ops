// Shared helpers for server actions.

// First line of the underlying error so users see the real reason instead of
// a generic "Failed to X". Falls back when the error has no usable message.
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message.split("\n").filter(Boolean).at(-1)?.trim() || fallback;
  }
  return fallback;
}

// Prisma unique-constraint violation (P2002), optionally scoped to a column.
export function isUniqueViolation(err: unknown, target?: string): boolean {
  if (
    typeof err !== "object" ||
    err === null ||
    !("code" in err) ||
    (err as { code: string }).code !== "P2002"
  ) {
    return false;
  }
  if (!target) return true;
  const meta = (err as { meta?: { target?: string[] | string } }).meta;
  const t = meta?.target;
  if (Array.isArray(t)) return t.includes(target);
  if (typeof t === "string") return t.includes(target);
  return true;
}

// Retry an operation that can race on an auto-generated unique value
// (e.g. sequential DO/SO numbers). `attempt` receives the retry index so it
// can regenerate the value. Non-P2002 errors propagate immediately.
export async function retryOnUniqueViolation<T>(
  attempt: () => Promise<T>,
  target: string,
  retries = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (!isUniqueViolation(err, target)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
