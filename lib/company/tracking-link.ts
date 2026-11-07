import { getPool } from "@/lib/db";
import { sendTrackingEmail } from "@/lib/mail";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import { photoBytes } from "@/lib/company/files";

const ENDED = new Set(["completed", "closed", "canceled"]);

export function requestOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export type CustomerStop = {
  sequence: number;
  kind: string;
  address: string | null;
  scheduledAt: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
};

export type CustomerProof = {
  id: string;
  kind: "pickup" | "delivery";
  latitude: number;
  longitude: number;
  takenAt: string;
};

export type CustomerPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
};

export type CustomerTracking = {
  companyName: string;
  customerName: string;
  status: string;
  vehicleRegistration: string | null;
  driverName: string | null;
  driverPhone: string | null;
  loadType: string | null;
  weightKg: number | null;
  stops: CustomerStop[];
  points: CustomerPoint[];
  proofs: CustomerProof[];
  expired: false;
} | {
  companyName: string;
  expired: true;
  reason: "delivered" | "canceled";
};

function instant(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function customerTracking(token: string): Promise<CustomerTracking | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  await ensureOperationsSchema();
  const pool = getPool();
  const trip = await pool.query<{
    id: string;
    status: string;
    company_name: string;
    customer_name: string | null;
    registration_number: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    load_type: string | null;
    weight_kg: string | null;
  }>(
    `SELECT t.id, t.status, co.name AS company_name, c.name AS customer_name,
            v.registration_number, d.full_name AS driver_name, d.phone AS driver_phone,
            o.load_type, o.weight_kg
     FROM trips t
     JOIN companies co ON co.id = t.company_id
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN drivers d ON d.id = t.driver_id
     LEFT JOIN orders o ON o.id = t.order_id
     WHERE t.tracking_token = $1 AND t.deleted_at IS NULL`,
    [token]
  );
  const row = trip.rows[0];
  if (!row) return null;
  if (ENDED.has(row.status)) {
    return {
      companyName: row.company_name,
      expired: true,
      reason: row.status === "canceled" ? "canceled" : "delivered",
    };
  }
  const stops = await pool.query<{
    sequence: number;
    kind: string;
    address: string | null;
    scheduled_at: Date | null;
    arrived_at: Date | null;
    departed_at: Date | null;
  }>(
    `SELECT sequence, kind, address, scheduled_at, arrived_at, departed_at
     FROM trip_stops WHERE trip_id = $1 ORDER BY sequence ASC`,
    [row.id]
  );
  const points = await pool.query<{
    latitude: number;
    longitude: number;
    recorded_at: Date;
    speed_kmh: number | null;
  }>(
    `SELECT latitude, longitude, recorded_at, speed_kmh
     FROM location_points
     WHERE trip_id = $1
     ORDER BY recorded_at DESC
     LIMIT 800`,
    [row.id]
  );
  const proofs = await pool.query<{
    id: string;
    kind: "pickup" | "delivery";
    latitude: number;
    longitude: number;
    taken_at: Date;
  }>(
    `SELECT id, kind, latitude, longitude, taken_at
     FROM trip_proofs WHERE trip_id = $1 ORDER BY taken_at ASC`,
    [row.id]
  );
  const weight = row.weight_kg == null ? null : Number(row.weight_kg);
  return {
    expired: false,
    companyName: row.company_name,
    customerName: row.customer_name ?? "Customer",
    status: row.status,
    vehicleRegistration: row.registration_number,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    loadType: row.load_type,
    weightKg: weight != null && Number.isFinite(weight) ? weight : null,
    stops: stops.rows.map((stop) => ({
      sequence: Number(stop.sequence),
      kind: stop.kind,
      address: stop.address,
      scheduledAt: instant(stop.scheduled_at),
      arrivedAt: instant(stop.arrived_at),
      departedAt: instant(stop.departed_at),
    })),
    points: points.rows.reverse().map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      recordedAt: point.recorded_at.toISOString(),
      speedKmh: point.speed_kmh == null ? null : Math.round(Number(point.speed_kmh) * 10) / 10,
    })),
    proofs: proofs.rows.map((proof) => ({
      id: proof.id,
      kind: proof.kind,
      latitude: Number(proof.latitude),
      longitude: Number(proof.longitude),
      takenAt: proof.taken_at.toISOString(),
    })),
  };
}

export async function customerProof(token: string, proofId: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(proofId)) {
    throw new Error("Photo was not found");
  }
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT p.image
     FROM trip_proofs p
     JOIN trips t ON t.id = p.trip_id
     WHERE p.id = $1 AND t.tracking_token = $2 AND t.deleted_at IS NULL
       AND t.status NOT IN ('completed', 'closed', 'canceled')`,
    [proofId, token]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}

export async function emailTrackingLink(input: {
  companyId: string;
  tripId: string;
  origin: string;
}) {
  await ensureOperationsSchema();
  const { rows } = await getPool().query<{
    token: string | null;
    status: string;
    email: string | null;
    customer_name: string | null;
    company_name: string;
    registration_number: string | null;
    pickup: string | null;
    dropoff: string | null;
  }>(
    `SELECT t.tracking_token AS token, t.status, c.email, c.name AS customer_name, co.name AS company_name,
            v.registration_number,
            first_stop.address AS pickup,
            last_stop.address AS dropoff
     FROM trips t
     JOIN companies co ON co.id = t.company_id
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN trip_stops first_stop ON first_stop.trip_id = t.id
       AND first_stop.sequence = (SELECT MIN(sequence) FROM trip_stops WHERE trip_id = t.id)
     LEFT JOIN trip_stops last_stop ON last_stop.trip_id = t.id
       AND last_stop.sequence = (SELECT MAX(sequence) FROM trip_stops WHERE trip_id = t.id)
     WHERE t.id = $1 AND t.company_id = $2 AND t.deleted_at IS NULL`,
    [input.tripId, input.companyId]
  );
  const row = rows[0];
  if (!row?.token) throw new Error("That trip was not found");
  if (ENDED.has(row.status)) throw new Error("You cannot send this link after the shipment has ended");
  if (!row.email) throw new Error("Customer email is required");
  const link = `${input.origin.replace(/\/$/, "")}/track/${row.token}`;
  const sent = await sendTrackingEmail({
    to: row.email,
    companyName: row.company_name,
    customerName: row.customer_name ?? "Customer",
    link,
    vehicle: row.registration_number,
    pickup: row.pickup,
    dropoff: row.dropoff,
  });
  return { emailed: sent.delivered, emailError: sent.delivered ? null : sent.error ?? "The tracking email could not be sent" };
}
