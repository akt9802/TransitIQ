import { getPool } from "@/lib/db";
import { countedKilometres, trackedKilometres } from "@/lib/company/geo";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { ensureOperationsSchema } from "@/lib/company/operations-schema";
import {
  DRIVE_LIMIT_HOURS,
  MOVE_METERS,
  restMessage,
  segmentMove,
  summarizeMotion,
  type MotionPoint,
} from "@/lib/company/motion";

export const TRACK_KEEP_DAYS = 10;
export const TRACK_GAP_MINUTES = 5;
export const SLEEP_TARGET_HOURS = 8;
export { DRIVE_LIMIT_HOURS, MOVE_METERS };

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
  movingHours: number;
  moveCount: number;
  drivingHours: number;
  restDue: boolean;
  liveMoveCount: number;
  liveMovingHours: number;
  liveSpeedKmh: number | null;
  liveMoving: boolean;
  averageSpeedKmh: number | null;
  liveAverageSpeedKmh: number | null;
  onTrip: boolean;
  dutyKey: string;
};

export type TrackingSnapshot = {
  keptDays: number;
  gapMinutes: number;
  sleepTargetHours: number;
  driveLimitHours: number;
  moveMeters: number;
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

function payAmount(payType: string, rate: number | null, km: number, trips: number) {
  if (rate == null) return null;
  if (payType === "per_km") return Math.round(rate * km);
  if (payType === "per_trip") return Math.round(rate * trips);
  if (payType === "salary") return Math.round(rate);
  return null;
}

const ASLEEP = "You are sleeping. You cannot drive until you wake up.";

export async function assertAwake(companyId: string, driverId: string) {
  const pool = getPool();
  const open = await pool.query(
    `SELECT 1 FROM hos_logs
     WHERE company_id = $1 AND driver_id = $2 AND kind = 'sleep' AND ended_at IS NULL
     LIMIT 1`,
    [companyId, driverId]
  );
  if ((open.rowCount ?? 0) > 0) throw new Error(ASLEEP);
}

export async function recordLocation(
  companyId: string,
  driverId: string,
  tripId: string,
  latitude: number,
  longitude: number
) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Location is not valid");
  }
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
  const recent = await pool.query<{ recorded_at: Date; latitude: number; longitude: number }>(
    `SELECT recorded_at, latitude, longitude FROM location_points
     WHERE trip_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [tripId]
  );
  const last = recent.rows[0];
  if (last && Date.now() - last.recorded_at.getTime() < GAP_MS) {
    return dutyStatus(companyId, driverId, tripId, false);
  }
  const now = Date.now();
  const segment = last
    ? segmentMove(
        {
          tripId,
          latitude: Number(last.latitude),
          longitude: Number(last.longitude),
          at: last.recorded_at.getTime(),
        },
        { tripId, latitude, longitude, at: now }
      )
    : null;
  await pool.query(
    `INSERT INTO location_points
       (company_id, vehicle_id, trip_id, driver_id, latitude, longitude, speed_kmh, moving, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'phone')`,
    [
      companyId,
      row.vehicle_id,
      tripId,
      driverId,
      latitude,
      longitude,
      segment?.speedKmh ?? null,
      segment?.moving ?? false,
    ]
  );
  if (row.vehicle_id && last) {
    const gained = countedKilometres(
      { latitude: Number(last.latitude), longitude: Number(last.longitude), at: last.recorded_at.getTime() },
      { latitude, longitude, at: now }
    );
    if (gained > 0) {
      await pool.query(
        `UPDATE vehicles SET tracked_km = tracked_km + $3, updated_at = now()
         WHERE id = $1 AND company_id = $2 AND odometer_km IS NOT NULL`,
        [row.vehicle_id, companyId, gained]
      );
    }
  }
  await pool.query(
    `DELETE FROM location_points
     WHERE company_id = $1 AND recorded_at < now() - ($2 || ' days')::interval`,
    [companyId, String(TRACK_KEEP_DAYS)]
  );
  if (segment?.moving) await assertAwake(companyId, driverId);
  return dutyStatus(companyId, driverId, tripId, true);
}

export type DutyStatus = {
  stored: boolean;
  speedKmh: number | null;
  averageSpeedKmh: number | null;
  moving: boolean;
  moveCount: number;
  drivingHours: number;
  driveLimitHours: number;
  restDue: boolean;
  dutyKey: string;
  restNotice: string | null;
};

async function dutyStatus(
  companyId: string,
  driverId: string,
  tripId: string,
  stored: boolean
): Promise<DutyStatus> {
  const motion = await driverMotion(companyId, driverId, tripId);
  return {
    stored,
    speedKmh: motion.liveSpeedKmh,
    averageSpeedKmh: motion.liveAverageSpeedKmh,
    moving: motion.liveMoving,
    moveCount: motion.liveMoveCount,
    drivingHours: motion.drivingHours,
    driveLimitHours: DRIVE_LIMIT_HOURS,
    restDue: motion.restDue,
    dutyKey: motion.dutyKey,
    restNotice: motion.restDue ? restMessage(motion.drivingHours) : null,
  };
}

async function driverMotion(companyId: string, driverId: string, liveTripId: string | null) {
  const pool = getPool();
  const points = await pool.query<{ trip_id: string | null; latitude: number; longitude: number; recorded_at: Date }>(
    `SELECT trip_id, latitude, longitude, recorded_at
     FROM location_points
     WHERE company_id = $1 AND driver_id = $2
       AND recorded_at > now() - ($3 || ' days')::interval
     ORDER BY recorded_at ASC`,
    [companyId, driverId, String(TRACK_KEEP_DAYS)]
  );
  const sleeps = await pool.query<{ started_at: Date; ended_at: Date | null }>(
    `SELECT started_at, ended_at
     FROM hos_logs
     WHERE company_id = $1 AND driver_id = $2 AND kind = 'sleep'
       AND (ended_at IS NULL OR ended_at > now() - ($3 || ' days')::interval)`,
    [companyId, driverId, String(TRACK_KEEP_DAYS)]
  );
  return summarizeMotion(
    points.rows.map((point) => ({
      tripId: point.trip_id,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      at: point.recorded_at.getTime(),
    })),
    sleeps.rows.map((sleep) => ({ start: sleep.started_at.getTime(), end: sleep.ended_at?.getTime() ?? null })),
    Date.now(),
    liveTripId
  );
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
  if (live.rows[0]) {
    const motion = await driverMotion(companyId, driverId, live.rows[0].id);
    if (motion.liveMoving) throw new Error("You cannot sleep while the truck is still moving.");
  }
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
       AND (ended_at IS NULL OR ended_at > now() - ($2 || ' days')::interval)
       AND ($3::uuid IS NULL OR driver_id = $3)`,
    [companyId, String(TRACK_KEEP_DAYS), onlyDriverId]
  );
  const liveTrips = await pool.query<{ id: string; driver_id: string }>(
    `SELECT id, driver_id
     FROM trips
     WHERE company_id = $1 AND deleted_at IS NULL
       AND status IN ('started', 'loading', 'in_transit', 'unloading')
       AND ($2::uuid IS NULL OR driver_id = $2)`,
    [companyId, onlyDriverId]
  );
  const now = Date.now();
  const liveByDriver = new Map(liveTrips.rows.map((trip) => [trip.driver_id, trip.id]));
  const byDriver = new Map<string, { latitude: number; longitude: number; at: number }[]>();
  const motionByDriver = new Map<string, MotionPoint[]>();
  const trails = new Map<string, { driverId: string; points: TrackPoint[] }>();
  const latest = new Map<string, TrackPoint>();
  for (const point of points.rows) {
    if (!point.driver_id) continue;
    const at = point.recorded_at.getTime();
    const list = byDriver.get(point.driver_id) ?? [];
    list.push({ latitude: point.latitude, longitude: point.longitude, at });
    byDriver.set(point.driver_id, list);
    const motion = motionByDriver.get(point.driver_id) ?? [];
    motion.push({
      tripId: point.trip_id,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      at,
    });
    motionByDriver.set(point.driver_id, motion);
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
    const km = trackedKilometres(byDriver.get(driver.id) ?? []);
    const tripsFinished = finishedByDriver.get(driver.id) ?? 0;
    const rate = driver.pay_rate == null ? null : Number(driver.pay_rate);
    const rest = sleepHours(sleeps.rows, driver.id, now);
    const motion = summarizeMotion(
      motionByDriver.get(driver.id) ?? [],
      sleeps.rows
        .filter((sleep) => sleep.driver_id === driver.id)
        .map((sleep) => ({ start: sleep.started_at.getTime(), end: sleep.ended_at?.getTime() ?? null })),
      now,
      liveByDriver.get(driver.id) ?? null
    );
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
      movingHours: motion.movingHours,
      moveCount: motion.moveCount,
      drivingHours: motion.drivingHours,
      restDue: motion.restDue,
      liveMoveCount: motion.liveMoveCount,
      liveMovingHours: motion.liveMovingHours,
      liveSpeedKmh: motion.liveSpeedKmh,
      liveMoving: motion.liveMoving,
      averageSpeedKmh: motion.averageSpeedKmh,
      liveAverageSpeedKmh: motion.liveAverageSpeedKmh,
      onTrip: liveByDriver.has(driver.id),
      dutyKey: motion.dutyKey,
    };
  });
  rows.sort((left, right) => right.kilometres - left.kilometres || left.driverName.localeCompare(right.driverName));
  return {
    keptDays: TRACK_KEEP_DAYS,
    gapMinutes: TRACK_GAP_MINUTES,
    sleepTargetHours: SLEEP_TARGET_HOURS,
    driveLimitHours: DRIVE_LIMIT_HOURS,
    moveMeters: MOVE_METERS,
    rows,
    trails: [...trails.entries()].map(([tripId, trail]) => ({
      tripId,
      driverId: trail.driverId,
      points: trail.points,
    })),
  };
}
