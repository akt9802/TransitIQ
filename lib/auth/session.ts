import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/auth/tokens";

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

export async function getUserName(userId: string): Promise<string | null> {
  const result = await getPool().query<{ full_name: string | null }>(
    `SELECT full_name FROM fleet_users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const name = result.rows[0]?.full_name?.trim();
  return name ? name : null;
}
