import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import { assertJpeg, photoBytes } from "@/lib/company/files";
import { resolveSpend, type SpendTiming } from "@/lib/company/spend";

export type FuelFill = {
  id: string;
  vehicleId: string;
  registrationNumber: string | null;
  driverId: string | null;
  driverName: string | null;
  tripId: string | null;
  timing: SpendTiming;
  customerName: string | null;
  filledAt: string;
  litres: number;
  amount: number;
  pricePerLitre: number;
  details: string | null;
  latitude: number | null;
  longitude: number | null;
};

function moneyNumber(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listFuel(companyId: string, onlyDriverId: string | null): Promise<FuelFill[]> {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{
    id: string;
    vehicle_id: string;
    registration_number: string | null;
    driver_id: string | null;
    driver_name: string | null;
    trip_id: string | null;
    timing: SpendTiming | null;
    customer_name: string | null;
    filled_at: Date;
    litres: string;
    amount: string;
    price_per_litre: string;
    details: string | null;
    latitude: number | null;
    longitude: number | null;
  }>(
    `SELECT f.id, f.vehicle_id, v.registration_number, f.driver_id, d.full_name AS driver_name,
            f.trip_id, f.timing, c.name AS customer_name, f.filled_at, f.litres, f.amount, f.price_per_litre, f.details,
            f.latitude, f.longitude
     FROM fuel_entries f
     LEFT JOIN vehicles v ON v.id = f.vehicle_id
     LEFT JOIN drivers d ON d.id = f.driver_id
     LEFT JOIN trips t ON t.id = f.trip_id
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE f.company_id = $1 AND f.deleted_at IS NULL
       AND ($2::uuid IS NULL OR f.driver_id = $2)
     ORDER BY f.filled_at DESC`,
    [companyId, onlyDriverId]
  );
  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    registrationNumber: row.registration_number,
    driverId: row.driver_id,
    driverName: row.driver_name,
    tripId: row.trip_id,
    timing: row.timing ?? (row.trip_id ? "on_trip" : "no_trip"),
    customerName: row.customer_name,
    filledAt: row.filled_at.toISOString(),
    litres: moneyNumber(row.litres),
    amount: moneyNumber(row.amount),
    pricePerLitre: moneyNumber(row.price_per_litre),
    details: row.details,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
  }));
}

export async function addFuel(input: {
  companyId: string;
  driverId: string;
  vehicleId: string;
  tripId: string | null;
  litres: number;
  amount: number;
  details: string;
  latitude: number;
  longitude: number;
  bytes: Buffer;
}) {
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Location is not valid");
  }
  if (!(input.litres > 0) || input.litres > 2000) throw new Error("Litres must be between 0 and 2000");
  if (!(input.amount > 0) || input.amount > 500000) throw new Error("Amount must be between 0 and 500000");
  const details = input.details.trim();
  if (details.length < 2) throw new Error("Fuel details are required");
  if (details.length > 200) throw new Error("Fuel details must be under 200 characters");
  const price = Math.round((input.amount / input.litres) * 100) / 100;
  if (price <= 0 || price > 999999) throw new Error("Amount is not valid");
  const spend = await resolveSpend(input.companyId, input.driverId, input.vehicleId, input.tripId);
  assertJpeg(input.bytes);
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO fuel_entries
       (id, company_id, vehicle_id, driver_id, trip_id, timing, litres, amount, price_per_litre, details, image, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.companyId,
      spend.vehicleId,
      input.driverId,
      spend.tripId,
      spend.timing,
      input.litres,
      input.amount,
      price,
      details,
      input.bytes,
      input.latitude,
      input.longitude,
    ]
  );
  return { id };
}

export async function fuelImage(companyId: string, id: string) {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT image FROM fuel_entries WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}
