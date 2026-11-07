import { getPool } from "@/lib/db";
import { assertActiveVehiclePapers, writeVehiclePapers, type VehiclePaperDraft } from "@/lib/company/papers";
import type { VehicleInput } from "@/lib/company/types";

function isUnique(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

const COLUMNS = `
  registration_number, make, model, year, chassis_number, engine_number,
  truck_type, load_capacity_kg, axle_count, length_m, width_m, height_m,
  ownership, contract_start, contract_end, status, odometer_km, tank_capacity_l,
  branch_id, vendor_id
`;

function values(input: VehicleInput): unknown[] {
  return [
    input.registrationNumber,
    input.make,
    input.model,
    input.year,
    input.chassisNumber,
    input.engineNumber,
    input.truckType,
    input.loadCapacityKg,
    input.axleCount,
    input.lengthM,
    input.widthM,
    input.heightM,
    input.ownership,
    input.contractStart,
    input.contractEnd,
    input.status,
    input.odometerKm,
    input.tankCapacityL,
    input.branchId,
    input.vendorId,
  ];
}

async function assertPlacement(companyId: string, input: VehicleInput) {
  const pool = getPool();
  if (input.branchId) {
    const branch = await pool.query(
      `SELECT 1 FROM branches WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [input.branchId, companyId]
    );
    if (!branch.rowCount) throw new Error("Choose a branch in this fleet");
  }
  if (input.vendorId) {
    const vendor = await pool.query(
      `SELECT 1 FROM vendors WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [input.vendorId, companyId]
    );
    if (!vendor.rowCount) throw new Error("Choose a vendor in this fleet");
  }
}

export async function addVehicle(
  companyId: string,
  input: VehicleInput,
  papers: VehiclePaperDraft[] = []
): Promise<"created" | "limit"> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const company = await client.query<{ vehicle_limit: number }>(
      `SELECT vehicle_limit FROM companies WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [companyId]
    );
    const limit = company.rows[0]?.vehicle_limit;
    if (limit == null) {
      await client.query("ROLLBACK");
      throw new Error("Set up your fleet first");
    }
    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM vehicles WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    if ((count.rows[0]?.n ?? 0) >= limit) {
      await client.query("ROLLBACK");
      return "limit";
    }
    assertActiveVehiclePapers(input.status, papers);
    await assertPlacement(companyId, input);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO vehicles (company_id, ${COLUMNS})
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
       )
       RETURNING id`,
      [companyId, ...values(input)]
    );
    const vehicleId = inserted.rows[0]?.id;
    if (!vehicleId) throw new Error("Could not add the truck");
    await writeVehiclePapers(client, companyId, vehicleId, papers);
    await client.query("COMMIT");
    return "created";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUnique(error)) throw new Error("This registration number is already in the fleet");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateVehicle(
  companyId: string,
  vehicleId: string,
  input: VehicleInput,
  papers: VehiclePaperDraft[] = []
): Promise<boolean> {
  const pool = getPool();
  assertActiveVehiclePapers(input.status, papers);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertPlacement(companyId, input);
    const updated = await client.query(
      `UPDATE vehicles SET
         registration_number = $3,
         make = $4,
         model = $5,
         year = $6,
         chassis_number = $7,
         engine_number = $8,
         truck_type = $9,
         load_capacity_kg = $10,
         axle_count = $11,
         length_m = $12,
         width_m = $13,
         height_m = $14,
         ownership = $15,
         contract_start = $16,
         contract_end = $17,
         status = $18,
         odometer_km = $19,
         tank_capacity_l = $20,
         branch_id = $21,
         vendor_id = $22,
         updated_at = now()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [vehicleId, companyId, ...values(input)]
    );
    if (updated.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }
    await writeVehiclePapers(client, companyId, vehicleId, papers);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUnique(error)) throw new Error("This registration number is already in the fleet");
    throw error;
  } finally {
    client.release();
  }
}

export function vehicleLimitMessage(limit: number): string {
  return `This plan includes ${limit} trucks.`;
}
