import { getPool } from "@/lib/db";
import { trackedKilometres } from "@/lib/company/geo";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";

export type SpendTiming = "before_trip" | "on_trip" | "after_trip" | "no_trip";

const LIVE = ["started", "loading", "in_transit", "unloading"];

export function timingForStatus(status: string): SpendTiming | null {
  if (status === "created" || status === "assigned") return "before_trip";
  if (LIVE.includes(status)) return "on_trip";
  if (status === "completed" || status === "closed") return "after_trip";
  return null;
}

export async function resolveSpend(
  companyId: string,
  driverId: string,
  vehicleId: string,
  tripId: string | null
): Promise<{ vehicleId: string; tripId: string | null; timing: SpendTiming }> {
  await ensureOperationsSchema();
  const pool = getPool();
  if (!tripId) {
    const vehicle = await pool.query<{ status: string }>(
      `SELECT status FROM vehicles WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [vehicleId, companyId]
    );
    const row = vehicle.rows[0];
    if (!row) throw new Error("Choose a truck in this fleet");
    if (row.status === "retired") throw new Error("This truck is retired");
    return { vehicleId, tripId: null, timing: "no_trip" };
  }
  const trip = await pool.query<{ status: string; vehicle_id: string | null; completed_at: Date | null }>(
    `SELECT status, vehicle_id, completed_at FROM trips
     WHERE id = $1 AND company_id = $2 AND driver_id = $3 AND deleted_at IS NULL`,
    [tripId, companyId, driverId]
  );
  const row = trip.rows[0];
  if (!row) throw new Error("That trip was not found");
  if (row.status === "canceled") throw new Error("You cannot add this to a canceled trip");
  const timing = timingForStatus(row.status);
  if (!timing || !row.vehicle_id) throw new Error("Choose a truck in this fleet");
  if (timing === "after_trip") {
    const ended = row.completed_at?.getTime() ?? 0;
    if (!ended || Date.now() - ended > 10 * 24 * 60 * 60 * 1000) {
      throw new Error("You cannot add this to a trip older than 10 days");
    }
  }
  return { vehicleId: row.vehicle_id, tripId, timing };
}

export type VehicleAverage = {
  vehicleId: string;
  registrationNumber: string;
  kilometres: number;
  litres: number;
  kmPerLitre: number | null;
  fuelAmount: number;
  extraAmount: number;
};

export async function vehicleAverages(companyId: string, onlyDriverId: string | null): Promise<VehicleAverage[]> {
  await ensureOperationsSchema();
  const pool = getPool();
  const points = await pool.query<{ vehicle_id: string | null; latitude: number; longitude: number; recorded_at: Date }>(
    `SELECT vehicle_id, latitude, longitude, recorded_at
     FROM location_points
     WHERE company_id = $1
       AND recorded_at > now() - interval '10 days'
       AND ($2::uuid IS NULL OR driver_id = $2)
     ORDER BY recorded_at ASC`,
    [companyId, onlyDriverId]
  );
  const fuel = await pool.query<{ vehicle_id: string; registration_number: string | null; litres: string; amount: string }>(
    `SELECT f.vehicle_id, v.registration_number, f.litres, f.amount
     FROM fuel_entries f
     JOIN vehicles v ON v.id = f.vehicle_id
     WHERE f.company_id = $1 AND f.deleted_at IS NULL
       AND f.filled_at > now() - interval '10 days'
       AND ($2::uuid IS NULL OR f.driver_id = $2)`,
    [companyId, onlyDriverId]
  );
  const extra = await pool.query<{ vehicle_id: string; registration_number: string | null; amount: string }>(
    `SELECT c.vehicle_id, v.registration_number, c.amount
     FROM extra_costs c
     JOIN vehicles v ON v.id = c.vehicle_id
     WHERE c.company_id = $1 AND c.deleted_at IS NULL
       AND c.spent_at > now() - interval '10 days'
       AND ($2::uuid IS NULL OR c.driver_id = $2)`,
    [companyId, onlyDriverId]
  );
  const byVehicle = new Map<string, { latitude: number; longitude: number; at: number }[]>();
  for (const point of points.rows) {
    if (!point.vehicle_id) continue;
    const list = byVehicle.get(point.vehicle_id) ?? [];
    list.push({ latitude: Number(point.latitude), longitude: Number(point.longitude), at: point.recorded_at.getTime() });
    byVehicle.set(point.vehicle_id, list);
  }
  const rows = new Map<string, VehicleAverage>();
  function row(id: string, registration: string | null) {
    const current = rows.get(id);
    if (current) return current;
    const created: VehicleAverage = {
      vehicleId: id,
      registrationNumber: registration ?? "Truck",
      kilometres: trackedKilometres(byVehicle.get(id) ?? []),
      litres: 0,
      kmPerLitre: null,
      fuelAmount: 0,
      extraAmount: 0,
    };
    rows.set(id, created);
    return created;
  }
  for (const item of fuel.rows) {
    const current = row(item.vehicle_id, item.registration_number);
    current.litres += Number(item.litres);
    current.fuelAmount += Number(item.amount);
  }
  for (const item of extra.rows) {
    const current = row(item.vehicle_id, item.registration_number);
    current.extraAmount += Number(item.amount);
  }
  for (const [id, list] of byVehicle) {
    if (!rows.has(id)) continue;
    const current = rows.get(id);
    if (current) current.kilometres = trackedKilometres(list);
  }
  return [...rows.values()]
    .map((item) => ({
      ...item,
      litres: Math.round(item.litres * 1000) / 1000,
      fuelAmount: Math.round(item.fuelAmount * 100) / 100,
      extraAmount: Math.round(item.extraAmount * 100) / 100,
      kmPerLitre: item.litres > 0 && item.kilometres > 0 ? Math.round((item.kilometres / item.litres) * 10) / 10 : null,
    }))
    .sort((left, right) => right.fuelAmount + right.extraAmount - (left.fuelAmount + left.extraAmount));
}
