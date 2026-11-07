import { getPool } from "@/lib/db";
import { trackedKilometres } from "@/lib/company/geo";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import type { TripCost, TripCostLine } from "@/lib/company/types";

const ON_TRIP = new Set(["before_trip", "on_trip", "after_trip"]);
const FINISHED = new Set(["completed", "closed"]);

function money(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function blank(status: string): TripCost {
  return {
    fuelAmount: 0,
    fuelLitres: 0,
    extraAmount: 0,
    kilometres: 0,
    payType: null,
    payRate: null,
    payAmount: null,
    payNote: payNote(status, null, null, 0),
    total: 0,
    lines: [],
  };
}

function payNote(status: string, payType: string | null, rate: number | null, kilometres: number) {
  if (!payType) return "No driver is assigned, so pay is not added.";
  if (rate == null) return "Rate not set, so pay is not added.";
  if (payType === "salary") return "Monthly salary is not added to this trip.";
  if (payType === "per_trip" && status === "canceled") return "Per-trip pay is not added to a canceled trip.";
  if (payType === "per_trip" && !FINISHED.has(status)) return "Per-trip pay is added when the trip is finished.";
  if (payType === "per_trip") return "One finished trip.";
  if (payType === "per_km") return `₹${rate.toLocaleString("en-IN")} per km × ${kilometres.toLocaleString("en-IN")} km.`;
  return "Pay is not added.";
}

function payRupees(status: string, payType: string | null, rate: number | null, kilometres: number) {
  if (rate == null || !payType) return null;
  if (payType === "salary") return null;
  if (payType === "per_km") return Math.round(rate * kilometres);
  if (payType === "per_trip" && FINISHED.has(status)) return Math.round(rate);
  return null;
}

export async function costsForTrips(
  companyId: string,
  trips: { id: string; status: string; driverId: string | null }[]
): Promise<Map<string, TripCost>> {
  const costs = new Map<string, TripCost>();
  if (trips.length === 0) return costs;
  await ensureOperationsSchema();
  const pool = getPool();
  const ids = trips.map((trip) => trip.id);
  const driverIds = [...new Set(trips.map((trip) => trip.driverId).filter((id): id is string => Boolean(id)))];
  const [fuel, extra, points, drivers] = await Promise.all([
    pool.query<{
      id: string;
      trip_id: string;
      timing: TripCostLine["timing"];
      filled_at: Date;
      litres: string;
      amount: string;
      details: string | null;
    }>(
      `SELECT id, trip_id, timing, filled_at, litres, amount, details
       FROM fuel_entries
       WHERE company_id = $1 AND deleted_at IS NULL
         AND trip_id = ANY($2::uuid[])
         AND timing IN ('before_trip', 'on_trip', 'after_trip')
       ORDER BY filled_at ASC`,
      [companyId, ids]
    ),
    pool.query<{
      id: string;
      trip_id: string;
      timing: TripCostLine["timing"];
      kind: "puncture" | "engine" | "other";
      spent_at: Date;
      amount: string;
      details: string;
    }>(
      `SELECT id, trip_id, timing, kind, spent_at, amount, details
       FROM extra_costs
       WHERE company_id = $1 AND deleted_at IS NULL
         AND trip_id = ANY($2::uuid[])
         AND timing IN ('before_trip', 'on_trip', 'after_trip')
       ORDER BY spent_at ASC`,
      [companyId, ids]
    ),
    pool.query<{ trip_id: string; latitude: number; longitude: number; recorded_at: Date }>(
      `SELECT trip_id, latitude, longitude, recorded_at
       FROM location_points
       WHERE company_id = $1 AND trip_id = ANY($2::uuid[])
       ORDER BY recorded_at ASC`,
      [companyId, ids]
    ),
    driverIds.length
      ? pool.query<{ id: string; pay_type: string; pay_rate: string | null }>(
          `SELECT id, pay_type, pay_rate FROM drivers WHERE company_id = $1 AND id = ANY($2::uuid[])`,
          [companyId, driverIds]
        )
      : Promise.resolve({ rows: [] as { id: string; pay_type: string; pay_rate: string | null }[] }),
  ]);
  const byDriver = new Map(drivers.rows.map((row) => [row.id, row]));
  const kmByTrip = new Map<string, { latitude: number; longitude: number; at: number }[]>();
  for (const point of points.rows) {
    const list = kmByTrip.get(point.trip_id) ?? [];
    list.push({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      at: point.recorded_at.getTime(),
    });
    kmByTrip.set(point.trip_id, list);
  }
  const linesByTrip = new Map<string, TripCostLine[]>();
  for (const row of fuel.rows) {
    if (!ON_TRIP.has(row.timing)) continue;
    const list = linesByTrip.get(row.trip_id) ?? [];
    list.push({
      id: row.id,
      kind: "fuel",
      timing: row.timing,
      at: row.filled_at.toISOString(),
      amount: money(row.amount),
      detail: row.details?.trim() || "Fuel",
      litres: Number.isFinite(Number(row.litres)) ? Math.round(Number(row.litres) * 1000) / 1000 : 0,
    });
    linesByTrip.set(row.trip_id, list);
  }
  for (const row of extra.rows) {
    if (!ON_TRIP.has(row.timing)) continue;
    const list = linesByTrip.get(row.trip_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind,
      timing: row.timing,
      at: row.spent_at.toISOString(),
      amount: money(row.amount),
      detail: row.details,
      litres: null,
    });
    linesByTrip.set(row.trip_id, list);
  }
  for (const trip of trips) {
    const lines = (linesByTrip.get(trip.id) ?? []).sort((left, right) => left.at.localeCompare(right.at));
    const fuelLines = lines.filter((line) => line.kind === "fuel");
    const fuelAmount = money(fuelLines.reduce((sum, line) => sum + line.amount, 0));
    const fuelLitres = Math.round(fuelLines.reduce((sum, line) => sum + (line.litres ?? 0), 0) * 1000) / 1000;
    const extraAmount = money(lines.filter((line) => line.kind !== "fuel").reduce((sum, line) => sum + line.amount, 0));
    const kilometres = trackedKilometres(kmByTrip.get(trip.id) ?? []);
    const driver = trip.driverId ? byDriver.get(trip.driverId) : undefined;
    const payType = driver?.pay_type ?? null;
    const rateValue = driver?.pay_rate == null ? null : Number(driver.pay_rate);
    const payRate = rateValue != null && Number.isFinite(rateValue) ? rateValue : null;
    const payAmount = payRupees(trip.status, payType, payRate, kilometres);
    costs.set(trip.id, {
      fuelAmount,
      fuelLitres,
      extraAmount,
      kilometres,
      payType,
      payRate,
      payAmount,
      payNote: payNote(trip.status, payType, payRate, kilometres),
      total: money(fuelAmount + extraAmount + (payAmount ?? 0)),
      lines,
    });
  }
  return costs;
}

export function emptyTripCost(status: string): TripCost {
  return blank(status);
}
