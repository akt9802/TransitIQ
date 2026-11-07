import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import { assertJpeg, photoBytes } from "@/lib/company/files";
import { resolveSpend, type SpendTiming } from "@/lib/company/spend";

export const COST_KINDS = ["puncture", "engine", "other"] as const;
export type CostKind = (typeof COST_KINDS)[number];

export type ExtraCost = {
  id: string;
  vehicleId: string;
  registrationNumber: string | null;
  driverName: string | null;
  tripId: string | null;
  timing: SpendTiming;
  kind: CostKind;
  customerName: string | null;
  spentAt: string;
  amount: number;
  details: string;
  latitude: number | null;
  longitude: number | null;
};

function moneyNumber(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listCosts(companyId: string, onlyDriverId: string | null): Promise<ExtraCost[]> {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{
    id: string;
    vehicle_id: string;
    registration_number: string | null;
    driver_name: string | null;
    trip_id: string | null;
    timing: SpendTiming;
    kind: CostKind;
    customer_name: string | null;
    spent_at: Date;
    amount: string;
    details: string;
    latitude: number | null;
    longitude: number | null;
  }>(
    `SELECT c.id, c.vehicle_id, v.registration_number, d.full_name AS driver_name,
            c.trip_id, c.timing, c.kind, cu.name AS customer_name, c.spent_at, c.amount, c.details,
            c.latitude, c.longitude
     FROM extra_costs c
     LEFT JOIN vehicles v ON v.id = c.vehicle_id
     LEFT JOIN drivers d ON d.id = c.driver_id
     LEFT JOIN trips t ON t.id = c.trip_id
     LEFT JOIN customers cu ON cu.id = t.customer_id
     WHERE c.company_id = $1 AND c.deleted_at IS NULL
       AND ($2::uuid IS NULL OR c.driver_id = $2)
     ORDER BY c.spent_at DESC`,
    [companyId, onlyDriverId]
  );
  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    registrationNumber: row.registration_number,
    driverName: row.driver_name,
    tripId: row.trip_id,
    timing: row.timing,
    kind: row.kind,
    customerName: row.customer_name,
    spentAt: row.spent_at.toISOString(),
    amount: moneyNumber(row.amount),
    details: row.details,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
  }));
}

export async function addCost(input: {
  companyId: string;
  driverId: string;
  vehicleId: string;
  tripId: string | null;
  kind: CostKind;
  amount: number;
  details: string;
  latitude: number;
  longitude: number;
  bytes: Buffer;
}) {
  if (!COST_KINDS.includes(input.kind)) throw new Error("Choose what the cost was for");
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Location is not valid");
  }
  if (!(input.amount > 0) || input.amount > 500000) throw new Error("Amount must be between 0 and 500000");
  const details = input.details.trim();
  if (details.length < 2) throw new Error("Cost details are required");
  if (details.length > 200) throw new Error("Cost details must be under 200 characters");
  const spend = await resolveSpend(input.companyId, input.driverId, input.vehicleId, input.tripId);
  assertJpeg(input.bytes);
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO extra_costs
       (id, company_id, vehicle_id, driver_id, trip_id, timing, kind, amount, details, image, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      input.companyId,
      spend.vehicleId,
      input.driverId,
      spend.tripId,
      spend.timing,
      input.kind,
      input.amount,
      details,
      input.bytes,
      input.latitude,
      input.longitude,
    ]
  );
  return { id };
}

export async function costImage(companyId: string, id: string) {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT image FROM extra_costs WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}
