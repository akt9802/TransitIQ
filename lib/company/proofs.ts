import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { metersBetween, STOP_RANGE_METERS } from "@/lib/company/geo";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import { assertJpeg, photoBytes } from "@/lib/company/files";
import type { TripProof } from "@/lib/company/types";

export const PROOF_MIN = 2;
export const PROOF_MAX = 3;

export async function proofsForTrips(companyId: string, tripIds: string[]): Promise<Map<string, TripProof[]>> {
  const grouped = new Map<string, TripProof[]>();
  if (tripIds.length === 0) return grouped;
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{
    id: string;
    trip_id: string;
    kind: "pickup" | "delivery";
    latitude: number;
    longitude: number;
    taken_at: Date;
  }>(
    `SELECT id, trip_id, kind, latitude, longitude, taken_at
     FROM trip_proofs
     WHERE company_id = $1 AND trip_id = ANY($2::uuid[])
     ORDER BY taken_at ASC`,
    [companyId, tripIds]
  );
  for (const row of rows) {
    const list = grouped.get(row.trip_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      takenAt: row.taken_at.toISOString(),
    });
    grouped.set(row.trip_id, list);
  }
  return grouped;
}

export async function addTripProof(
  companyId: string,
  driverId: string,
  tripId: string,
  kind: "pickup" | "delivery",
  latitude: number,
  longitude: number,
  bytes: Buffer
) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Location is not valid");
  }
  await ensureOperationsSchema();
  const pool = getPool();
  const trip = await pool.query<{ status: string; driver_id: string | null }>(
    `SELECT status, driver_id FROM trips
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [tripId, companyId]
  );
  const row = trip.rows[0];
  if (!row) throw new Error("That trip was not found");
  if (row.driver_id !== driverId) throw new Error("You cannot change this");
  const expected = kind === "pickup" ? "loading" : "unloading";
  if (row.status !== expected) throw new Error("You cannot add this photo yet");
  const stops = await pool.query<{
    id: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  }>(
    `SELECT id, latitude, longitude, address FROM trip_stops
     WHERE trip_id = $1
     ORDER BY sequence ${kind === "pickup" ? "ASC" : "DESC"}
     LIMIT 1`,
    [tripId]
  );
  const stop = stops.rows[0];
  if (!stop) throw new Error("A start and an end are required");
  if (stop.latitude == null || stop.longitude == null) throw new Error("This stop location is not valid");
  const meters = metersBetween({ lat: latitude, lng: longitude }, { lat: Number(stop.latitude), lng: Number(stop.longitude) });
  if (meters > STOP_RANGE_METERS) {
    throw new Error(kind === "pickup" ? "You are not at the pickup. Take the photo there." : "You are not at the delivery. Take the photo there.");
  }
  const count = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM trip_proofs WHERE trip_id = $1 AND kind = $2`,
    [tripId, kind]
  );
  if ((count.rows[0]?.n ?? 0) >= PROOF_MAX) throw new Error("You cannot add more than 3 photos");
  assertJpeg(bytes);
  const id = randomUUID();
  await pool.query(
    `INSERT INTO trip_proofs
       (id, company_id, trip_id, trip_stop_id, driver_id, kind, image, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, companyId, tripId, stop.id, driverId, kind, bytes, latitude, longitude]
  );
  return { id };
}

export async function proofImage(companyId: string, id: string) {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT image FROM trip_proofs WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}
