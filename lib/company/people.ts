import { getPool } from "@/lib/db";
import type { PersonInput } from "@/lib/company/types";

function uniqueEmail(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

async function roleId(key: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM roles WHERE key = $1`, [key]);
  const id = rows[0]?.id;
  if (!id) throw new Error("That role is not available");
  return id;
}

export async function addPerson(companyId: string, input: PersonInput): Promise<void> {
  const pool = getPool();
  const assignedRole = await roleId(input.roleKey);
  try {
    await pool.query(
      `INSERT INTO fleet_users (email, full_name, phone, company_id, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.email, input.fullName, input.phone, companyId, assignedRole]
    );
  } catch (error) {
    if (uniqueEmail(error)) {
      throw new Error("This email already has an account");
    }
    throw error;
  }
}

export async function updatePerson(
  companyId: string,
  personId: string,
  input: PersonInput
): Promise<"updated" | "missing" | "owner"> {
  const pool = getPool();
  const current = await pool.query<{ role_key: string | null }>(
    `SELECT r.key AS role_key
     FROM fleet_users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL`,
    [personId, companyId]
  );
  const row = current.rows[0];
  if (!row) return "missing";
  if (row.role_key === "owner") return "owner";

  const assignedRole = await roleId(input.roleKey);
  try {
    await pool.query(
      `UPDATE fleet_users
       SET full_name = $3,
           phone = $4,
           email = CASE WHEN password_hash IS NULL THEN $5 ELSE email END,
           role_id = $6,
           updated_at = now()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [personId, companyId, input.fullName, input.phone, input.email, assignedRole]
    );
  } catch (error) {
    if (uniqueEmail(error)) {
      throw new Error("This email already has an account");
    }
    throw error;
  }
  return "updated";
}
