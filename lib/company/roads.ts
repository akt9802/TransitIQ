import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { assertJpeg, photoBytes } from "@/lib/company/files";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { metersBetween } from "@/lib/company/geo";
import { indiaToday } from "@/lib/company/paper-rules";

export const POTHOLE_METERS = 50;
export const FIRST_POINTS = 12;
export const REPEAT_POINTS = 3;
const WARN_METERS = 400;

export type PotholeSpot = {
  id: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
  photoId: string;
  firstDriver: string;
  drivers: number;
};

export type OwnReport = {
  id: string;
  points: number;
  reportedAt: string;
  status: "pending" | "approved";
};

export type PendingPothole = {
  id: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
  photoId: string;
  driverName: string;
};

function indiaMonth(now = new Date()) {
  return indiaToday(now).slice(0, 7);
}

export async function reportPothole(
  companyId: string,
  driverId: string,
  latitude: number,
  longitude: number,
  image: Buffer
) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Location is not valid");
  }
  assertJpeg(image);
  await ensureFleetSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('potholes'))`);
    const driver = await client.query<{ status: string }>(
      `SELECT status FROM drivers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [driverId, companyId]
    );
    if (!driver.rows[0]) throw new Error("Choose a driver in this fleet");
    if (driver.rows[0].status === "inactive") throw new Error("This driver is inactive");

    const here = { lat: latitude, lng: longitude };
    const around = await nearbyPotholes(client, here);
    if (around.some((spot) => spot.driverId === driverId && (spot.status === "pending" || spot.status === "open") && spot.meters <= POTHOLE_METERS)) {
      throw new Error("You already reported this pothole");
    }
    const open = closest(around, "open");
    if (open) {
      try {
        await client.query(
          `INSERT INTO pothole_reports
             (company_id, pothole_id, driver_id, image, latitude, longitude, points, status, awarded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', now())`,
          [companyId, open.id, driverId, image, latitude, longitude, REPEAT_POINTS]
        );
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          throw new Error("You already reported this pothole");
        }
        throw error;
      }
      await rejectPendingNear(client, here, open.id);
      await client.query("COMMIT");
      return { state: "repeat" as const, points: REPEAT_POINTS };
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO potholes (company_id, latitude, longitude, status) VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [companyId, latitude, longitude]
    );
    await client.query(
      `INSERT INTO pothole_reports
         (company_id, pothole_id, driver_id, image, latitude, longitude, points, status)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending')`,
      [companyId, created.rows[0].id, driverId, image, latitude, longitude]
    );
    await client.query("COMMIT");
    return { state: "pending" as const, points: 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function ownPotholes(companyId: string, driverId: string) {
  await ensureFleetSchema();
  const month = indiaMonth();
  const pool = getPool();
  const [monthRows, earlierRows, reports] = await Promise.all([
    pool.query<{ points: string }>(
      `SELECT COALESCE(SUM(points), 0)::text AS points
       FROM pothole_reports
       WHERE driver_id = $1 AND awarded_at IS NOT NULL
         AND to_char(awarded_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = $2`,
      [driverId, month]
    ),
    pool.query<{ points: string }>(
      `SELECT COALESCE(SUM(points), 0)::text AS points
       FROM pothole_reports
       WHERE driver_id = $1 AND awarded_at IS NOT NULL
         AND to_char(awarded_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') <> $2`,
      [driverId, month]
    ),
    pool.query<{ id: string; points: number; reported_at: Date; status: "pending" | "approved" }>(
      `SELECT id, points, created_at AS reported_at, status
       FROM pothole_reports
       WHERE driver_id = $1 AND status <> 'rejected'
       ORDER BY created_at DESC
       LIMIT 20`,
      [driverId]
    ),
  ]);
  const monthPoints = Number(monthRows.rows[0]?.points ?? 0);
  return {
    monthPoints,
    monthRupees: monthPoints,
    earlierPoints: Number(earlierRows.rows[0]?.points ?? 0),
    reports: reports.rows.map((row): OwnReport => ({
      id: row.id,
      points: row.points,
      reportedAt: row.reported_at.toISOString(),
      status: row.status,
    })),
  };
}

const SPOT_SQL = `
  SELECT p.id, p.latitude, p.longitude, p.created_at AS reported_at,
         first_report.id AS photo_id,
         first_driver.full_name AS first_driver,
         (SELECT COUNT(*)::int FROM pothole_reports r WHERE r.pothole_id = p.id AND r.status = 'approved') AS drivers
  FROM potholes p
  JOIN LATERAL (
    SELECT r.id, r.driver_id
    FROM pothole_reports r
    WHERE r.pothole_id = p.id AND r.status <> 'rejected'
    ORDER BY r.created_at ASC
    LIMIT 1
  ) first_report ON true
  JOIN drivers first_driver ON first_driver.id = first_report.driver_id
`;

export async function roadCondition() {
  await ensureFleetSchema();
  const pool = getPool();
  const [queue, spots] = await Promise.all([
    pool.query<SpotRow>(`${SPOT_SQL} WHERE p.status = 'pending' ORDER BY p.created_at ASC`),
    pool.query<SpotRow>(`${SPOT_SQL} WHERE p.status = 'open' ORDER BY p.created_at DESC`),
  ]);
  return {
    queue: queue.rows.map(toPending),
    potholes: spots.rows.map(toSpot),
  };
}

export async function reviewPothole(id: string, action: "approve" | "reject" | "fix") {
  await ensureFleetSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('potholes'))`);
    const current = await client.query<{ id: string; status: string; latitude: number; longitude: number }>(
      `SELECT id, status, latitude, longitude FROM potholes WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const hole = current.rows[0];
    if (!hole) throw new Error("That pothole was not found");
    const here = { lat: hole.latitude, lng: hole.longitude };
    if (action === "fix") {
      if (hole.status === "fixed") throw new Error("This pothole is already fixed");
      if (hole.status !== "open") throw new Error("This pothole must be confirmed before it is fixed");
      await client.query(`UPDATE potholes SET status = 'fixed' WHERE id = $1`, [id]);
      await client.query("COMMIT");
      return { outcome: "fixed" as const };
    }
    if (hole.status !== "pending") throw new Error("This pothole is already reviewed");
    if (action === "reject") {
      await rejectHole(client, id);
      await client.query("COMMIT");
      return { outcome: "rejected" as const };
    }
    const open = closest(await nearbyPotholes(client, here), "open");
    if (open && open.id !== id) {
      await rejectHole(client, id);
      await client.query("COMMIT");
      return { outcome: "duplicate" as const };
    }
    await client.query(`UPDATE potholes SET status = 'open' WHERE id = $1`, [id]);
    await client.query(
      `UPDATE pothole_reports
       SET status = 'approved', points = $2, awarded_at = now()
       WHERE pothole_id = $1 AND status = 'pending'`,
      [id, FIRST_POINTS]
    );
    await rejectPendingNear(client, here, id);
    await client.query("COMMIT");
    return { outcome: "approved" as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function potholeAhead(companyId: string, driverId: string, tripId: string, latitude: number, longitude: number) {
  await ensureFleetSchema();
  const trip = await getPool().query<{ status: string }>(
    `SELECT status FROM trips
     WHERE id = $1 AND company_id = $2 AND driver_id = $3 AND deleted_at IS NULL`,
    [tripId, companyId, driverId]
  );
  const status = trip.rows[0]?.status;
  if (!status || !["started", "loading", "in_transit", "unloading"].includes(status)) return { text: null, potholeId: null };
  const stops = await getPool().query<{ latitude: number | null; longitude: number | null; arrived_at: Date | null }>(
    `SELECT latitude, longitude, arrived_at FROM trip_stops WHERE trip_id = $1 ORDER BY sequence ASC`,
    [tripId]
  );
  const pending = stops.rows.filter((stop) => !stop.arrived_at && stop.latitude != null && stop.longitude != null);
  const next = pending[0] ?? stops.rows.filter((stop) => stop.latitude != null && stop.longitude != null).at(-1);
  if (!next?.latitude || next.longitude == null) return { text: null, potholeId: null };
  const here = { lat: latitude, lng: longitude };
  const target = { lat: next.latitude, lng: next.longitude };
  const holes = await getPool().query<{ id: string; latitude: number; longitude: number }>(
    `SELECT id, latitude, longitude FROM potholes
     WHERE status = 'open'
       AND latitude BETWEEN $1 AND $2
       AND longitude BETWEEN $3 AND $4`,
    [latitude - 0.005, latitude + 0.005, longitude - 0.005, longitude + 0.005]
  );
  let best: { id: string; meters: number } | null = null;
  for (const hole of holes.rows) {
    const spot = { lat: hole.latitude, lng: hole.longitude };
    const meters = metersBetween(here, spot);
    if (meters > WARN_METERS) continue;
    const onRoad = meters <= 80 || (metersToSegment(spot, here, target) <= 80 && aheadOf(here, target, spot));
    if (!onRoad) continue;
    if (!best || meters < best.meters) best = { id: hole.id, meters };
  }
  if (!best) return { text: null, potholeId: null };
  const text = best.meters < 100 ? "Pothole here. Slow down." : `Pothole in ${Math.round(best.meters)} m. Slow down.`;
  return { text, potholeId: best.id };
}

export async function potholeImage(reportId: string, driverId: string | null) {
  await ensureFleetSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT image FROM pothole_reports
     WHERE id = $1 AND ($2::uuid IS NULL OR (driver_id = $2 AND status <> 'rejected'))`,
    [reportId, driverId]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}

type Near = { id: string; status: "pending" | "open" | "fixed" | "rejected"; driverId: string; meters: number };

async function nearbyPotholes(client: PoolClient, here: { lat: number; lng: number }) {
  const rows = await client.query<{ id: string; status: Near["status"]; latitude: number; longitude: number; driver_id: string }>(
    `SELECT p.id, p.status, p.latitude, p.longitude, r.driver_id
     FROM potholes p
     JOIN pothole_reports r ON r.pothole_id = p.id
     WHERE p.latitude BETWEEN $1 AND $2
       AND p.longitude BETWEEN $3 AND $4
       AND r.created_at = (SELECT MIN(created_at) FROM pothole_reports WHERE pothole_id = p.id)`,
    [here.lat - 0.001, here.lat + 0.001, here.lng - 0.001, here.lng + 0.001]
  );
  return rows.rows.map((row) => ({
    id: row.id,
    status: row.status,
    driverId: row.driver_id,
    meters: metersBetween(here, { lat: row.latitude, lng: row.longitude }),
  }));
}

function closest(spots: Near[], status: Near["status"]) {
  return spots
    .filter((spot) => spot.status === status && spot.meters <= POTHOLE_METERS)
    .sort((left, right) => left.meters - right.meters)[0] ?? null;
}

async function rejectHole(client: PoolClient, id: string) {
  await client.query(`UPDATE potholes SET status = 'rejected' WHERE id = $1 AND status = 'pending'`, [id]);
  await client.query(
    `UPDATE pothole_reports SET status = 'rejected', points = 0, awarded_at = NULL WHERE pothole_id = $1 AND status = 'pending'`,
    [id]
  );
}

async function rejectPendingNear(client: PoolClient, here: { lat: number; lng: number }, keepId: string) {
  const spots = await nearbyPotholes(client, here);
  for (const spot of spots) {
    if (spot.status === "pending" && spot.id !== keepId && spot.meters <= POTHOLE_METERS) {
      await rejectHole(client, spot.id);
    }
  }
}

type SpotRow = {
  id: string;
  latitude: number;
  longitude: number;
  reported_at: Date;
  photo_id: string;
  first_driver: string;
  drivers: number;
};

function toSpot(row: SpotRow): PotholeSpot {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    reportedAt: row.reported_at.toISOString(),
    photoId: row.photo_id,
    firstDriver: row.first_driver,
    drivers: row.drivers,
  };
}

function toPending(row: SpotRow): PendingPothole {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    reportedAt: row.reported_at.toISOString(),
    photoId: row.photo_id,
    driverName: row.first_driver,
  };
}

function metersToSegment(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((start.lat * Math.PI) / 180);
  const bx = (end.lng - start.lng) * lngScale;
  const by = (end.lat - start.lat) * latScale;
  const px = (point.lng - start.lng) * lngScale;
  const py = (point.lat - start.lat) * latScale;
  const length = bx * bx + by * by;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / length));
  return Math.hypot(px - t * bx, py - t * by);
}

function aheadOf(
  here: { lat: number; lng: number },
  target: { lat: number; lng: number },
  spot: { lat: number; lng: number }
) {
  const toBearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const lat1 = (from.lat * Math.PI) / 180;
    const lat2 = (to.lat * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return Math.atan2(y, x);
  };
  const difference = Math.abs(toBearing(here, target) - toBearing(here, spot));
  const turn = difference > Math.PI ? 2 * Math.PI - difference : difference;
  return turn <= Math.PI / 2;
}
