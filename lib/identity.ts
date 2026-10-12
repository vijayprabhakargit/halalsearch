import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const IDENTITY_COOKIE = "hs_id";

/**
 * Secret for signing the identity cookie. Prefer IDENTITY_SECRET; fall back to
 * the DB token (stable across deploys) so signatures survive redeploys.
 */
function secret(): string {
  return (
    process.env.IDENTITY_SECRET ||
    process.env.TURSO_AUTH_TOKEN ||
    "halalsearch-dev-secret"
  );
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

/** Mint a new signed identity: `{id}.{signature}`. */
export function issueIdentity(): { id: string; cookie: string } {
  const id = randomUUID();
  return { id, cookie: `${id}.${sign(id)}` };
}

/** Verify a signed identity cookie and return the id, or null if invalid. */
export function verifyIdentity(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    return timingSafeEqual(a, b) ? id : null;
  } catch {
    return null;
  }
}
