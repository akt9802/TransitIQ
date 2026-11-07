import { getPool } from "@/lib/db";
import { metersBetween } from "@/lib/company/geo";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";

export const TRACK_KEEP_DAYS = 10;
export const TRACK_GAP_MINUTES = 5;
export const SLEEP_TARGET_HOURS = 8;

const LIVE = ["started", "loading", "in_transit", "unloading"];
const GAP_MS = TRACK_GAP_MINUTES * 60 * 1000;

export type TrackPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  tripId: string | null;
};

export type DriverTracking = {
  driverId: string;
  driverName: string;
  kilometres: number;
  tripsFinished: number;
  payType: string;
  payRate: number | null;
  amount: number | null;
  sleepHours: number;
  sleepingSince: string | null;
  latest: TrackPoint | null;
};

export type TrackingSnapshot = {
  keptDays: number;
  gapMinutes: number;
  sleepTargetHours: number;
  rows: DriverTracking[];
  trails: { tripId: string; driverId: string; points: TrackPoint[] }[];
};

type PointRow = {
  driver_id: string | null;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  recorded_at: Date;
  trip_status: string | null;
};

async function ready() {
  await ensureFleetSchema();
  await ensureOperationsSchema();
}

function kolkataDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function sleepHours(
  logs: { driver_id: string; started_at: Date; ended_at: Date | null }[],
  driverId: string,
  now: number
) {
  const day = kolkataDay(now);
  let hours = 0;
  let sleepingSince: string | null = null;
  for (const log of logs) {
    if (log.driver_id !== driverId) continue;
    const started = log.started_at.getTime();
    const ended = log.ended_at?.getTime() ?? now;
    const from = Math.max(started, day.start);
    const to = Math.min(ended, day.end, now);
    if (to > from) hours += (to - from) / 3600000;
    if (!log.ended_at) sleepingSince = log.started_at.toISOString();
  }
  return { hours, sleepingSince };
}

function kilometres(points: { latitude: number; longitude: number; at: number }[]) {
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].at - points[index - 1].at;
    if (gap <= 0 || gap > 20 * 60 * 1000) continue;
    const segment = metersBetween(
      { lat: points[index - 1].latitude, lng: points[index - 1].longitude },
      { lat: points[index].latitude, lng: points[index].longitude }
    );
    if (segment > 20000) continue;
    meters += segment;
  }
  return Math.round((meters / 1000) * 10) / 10;
}

function payAmount(payType: string, rate: number | null, km: number, trips: number) {
  if (rate == null) return null;
  if (payType === "per_km") return Math.round(rate * km);
  if (payType === "per_trip") return Math.round(rate * trips);
  if (payType === "salary") return Math.round(rate);
  return null;
}

export async function recordLocation(
  companyId: string,
  driverId: string,
  tripId: string,
  latitude: number,
  longitude: number
) {
  await ready();
  const pool = getPool();
  const trip = await pool.query<{
    vehicle_id: string | null;
    status: string;
    started_at: Date | null;
  }>(
    `SELECT vehicle_id, status, started_at
     FROM trips
     WHERE id = $1 AND company_id = $2 AND driver_id = $3 AND deleted_at IS NULL`,
    [tripId, companyId, driverId]
  );
  const row = trip.rows[0];
  if (!row) throw new Error("That trip was not found");
  if (!LIVE.includes(row.status)) throw new Error("This trip cannot be tracked until it is started");
  if (row.started_at && Date.now() - row.started_at.getTime() > TRACK_KEEP_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error("This trip cannot be tracked after 10 days");
  }
  const recent = await pool.query<{ recorded_at: Date }>(
    `SELECT recorded_at FROM location_points
     WHERE trip_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [tripId]
  );
  const last = recent.rows[0]?.recorded_at;
  if (last && Date.now() - last.getTime() < GAP_MS) return { stored: false };
  await pool.query(
    `INSERT INTO location_points (company_id, vehicle_id, trip_id, driver_id, latitude, longitude, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'phone')`,
    [companyId, row.vehicle_id, tripId, driverId, latitude, longitude]
  );
  await pool.query(
    `DELETE FROM location_points
     WHERE company_id = $1 AND recorded_at < now() - ($2 || ' days')::interval`,
    [companyId, String(TRACK_KEEP_DAYS)]
  );
  return { stored: true };
}

export async function setSleep(companyId: string, driverId: string, wake: boolean) {
  await ready();
  const pool = getPool();
  const open = await pool.query<{ id: string }>(
    `SELECT id FROM hos_logs
     WHERE company_id = $1 AND driver_id = $2 AND kind = 'sleep' AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [companyId, driverId]
  );
  if (wake) {
    if (!open.rows[0]) throw new Error("You cannot wake up because you are not sleeping");
    await pool.query(`UPDATE hos_logs SET ended_at = now() WHERE company_id = $1 AND driver_id = $2 AND kind = 'sleep' AND ended_at IS NULL`, [
      companyId,
      driverId,
    ]);
    return;
  }
  if (open.rows[0]) return;
  const live = await pool.query<{ id: string }>(
    `SELECT id FROM trips
     WHERE company_id = $1 AND driver_id = $2 AND deleted_at IS NULL
       AND status IN ('started', 'loading', 'in_transit', 'unloading')
     LIMIT 1`,
    [companyId, driverId]
  );
  await pool.query(
    `INSERT INTO hos_logs (company_id, driver_id, trip_id, kind, started_at)
     VALUES ($1, $2, $3, 'sleep', now())`,
    [companyId, driverId, live.rows[0]?.id ?? null]
  );
}

export async function trackingSnapshot(companyId: string, onlyDriverId: string | null): Promise<TrackingSnapshot> {
  await ready();
  const pool = getPool();
  const drivers = await pool.query<{ id: string; full_name: string; pay_type: string; pay_rate: string | null }>(
    `SELECT id, full_name, pay_type, pay_rate
     FROM drivers
     WHERE company_id = $1 AND deleted_at IS NULL AND status = 'active'
       AND ($2::uuid IS NULL OR id = $2)
     ORDER BY full_name`,
    [companyId, onlyDriverId]
  );
  const points = await pool.query<PointRow>(
    `SELECT p.driver_id, p.trip_id, p.latitude, p.longitude, p.recorded_at, t.status AS trip_status
     FROM location_points p
     LEFT JOIN trips t ON t.id = p.trip_id
     WHERE p.company_id = $1
       AND p.recorded_at > now() - ($2 || ' days')::interval
       AND ($3::uuid IS NULL OR p.driver_id = $3)
     ORDER BY p.recorded_at ASC`,
    [companyId, String(TRACK_KEEP_DAYS), onlyDriverId]
  );
  const finished = await pool.query<{ driver_id: string; trips: string }>(
    `SELECT driver_id, COUNT(*)::text AS trips
     FROM trips
     WHERE company_id = $1 AND deleted_at IS NULL
       AND status IN ('completed', 'closed')
       AND completed_at > now() - ($2 || ' days')::interval
       AND ($3::uuid IS NULL OR driver_id = $3)
     GROUP BY driver_id`,
    [companyId, String(TRACK_KEEP_DAYS), onlyDriverId]
  );
  const sleeps = await pool.query<{ driver_id: string; started_at: Date; ended_at: Date | null }>(
    `SELECT driver_id, started_at, ended_at
     FROM hos_logs
     WHERE company_id = $1 AND kind = 'sleep'
       AND started_at > now() - interval '2 days'
       AND ($2::uuid IS NULL OR driver_id = $2)`,
    [companyId, onlyDriverId]
  );
  const now = Date.now();
  const byDriver = new Map<string, { latitude: number; longitude: number; at: number }[]>();
  const trails = new Map<string, { driverId: string; points: TrackPoint[] }>();
  const latest = new Map<string, TrackPoint>();
  for (const point of points.rows) {
    if (!point.driver_id) continue;
    const at = point.recorded_at.getTime();
    const list = byDriver.get(point.driver_id) ?? [];
    list.push({ latitude: point.latitude, longitude: point.longitude, at });
    byDriver.set(point.driver_id, list);
    const recordedAt = point.recorded_at.toISOString();
    latest.set(point.driver_id, {
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt,
      tripId: point.trip_id,
    });
    if (point.trip_id && point.trip_status && LIVE.includes(point.trip_status)) {
      const trail = trails.get(point.trip_id) ?? { driverId: point.driver_id, points: [] };
      trail.points.push({
        latitude: point.latitude,
        longitude: point.longitude,
        recordedAt,
        tripId: point.trip_id,
      });
      trails.set(point.trip_id, trail);
    }
  }
  const finishedByDriver = new Map(finished.rows.map((row) => [row.driver_id, Number(row.trips)]));
  const rows = drivers.rows.map((driver) => {
    const km = kilometres(byDriver.get(driver.id) ?? []);
    const tripsFinished = finishedByDriver.get(driver.id) ?? 0;
    const rate = driver.pay_rate == null ? null : Number(driver.pay_rate);
    const rest = sleepHours(sleeps.rows, driver.id, now);
    return {
      driverId: driver.id,
      driverName: driver.full_name,
      kilometres: km,
      tripsFinished,
      payType: driver.pay_type,
      payRate: rate != null && Number.isFinite(rate) ? rate : null,
      amount: payAmount(driver.pay_type, rate != null && Number.isFinite(rate) ? rate : null, km, tripsFinished),
      sleepHours: Math.round(rest.hours * 10) / 10,
      sleepingSince: rest.sleepingSince,
      latest: latest.get(driver.id) ?? null,
    };
  });
  rows.sort((left, right) => right.kilometres - left.kilometres || left.driverName.localeCompare(right.driverName));
  return {
    keptDays: TRACK_KEEP_DAYS,
    gapMinutes: TRACK_GAP_MINUTES,
    sleepTargetHours: SLEEP_TARGET_HOURS,
    rows,
    trails: [...trails.entries()].map(([tripId, trail]) => ({
      tripId,
      driverId: trail.driverId,
      points: trail.points,
    })),
  };
}
