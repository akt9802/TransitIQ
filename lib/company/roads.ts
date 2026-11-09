import { getPool } from "@/lib/db";
import { assertJpeg, photoBytes } from "@/lib/company/files";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { metersBetween } from "@/lib/company/geo";
import { indiaToday } from "@/lib/company/paper-rules";

export const POTHOLE_METERS = 50;
export const FIRST_POINTS = 12;
export const REPEAT_POINTS = 3;

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

    const nearby = await client.query<{ id: string; latitude: number; longitude: number }>(
      `SELECT id, latitude, longitude
       FROM potholes
       WHERE latitude BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4`,
      [latitude - 0.001, latitude + 0.001, longitude - 0.001, longitude + 0.001]
    );
    let potholeId: string | null = null;
    let nearest = POTHOLE_METERS + 1;
    for (const spot of nearby.rows) {
      const meters = metersBetween({ lat: latitude, lng: longitude }, { lat: spot.latitude, lng: spot.longitude });
      if (meters <= POTHOLE_METERS && meters < nearest) {
        nearest = meters;
        potholeId = spot.id;
      }
    }
    const points = potholeId ? REPEAT_POINTS : FIRST_POINTS;
    if (!potholeId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO potholes (company_id, latitude, longitude) VALUES ($1, $2, $3) RETURNING id`,
        [companyId, latitude, longitude]
      );
      potholeId = created.rows[0].id;
    }
    try {
      await client.query(
        `INSERT INTO pothole_reports (company_id, pothole_id, driver_id, image, latitude, longitude, points)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [companyId, potholeId, driverId, image, latitude, longitude, points]
      );
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new Error("You already reported this pothole");
      }
      throw error;
    }
    await client.query("COMMIT");
    return { points, repeat: points === REPEAT_POINTS };
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
       WHERE driver_id = $1
         AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = $2`,
      [driverId, month]
    ),
    pool.query<{ points: string }>(
      `SELECT COALESCE(SUM(points), 0)::text AS points
       FROM pothole_reports
       WHERE driver_id = $1
         AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') <> $2`,
      [driverId, month]
    ),
    pool.query<{ id: string; points: number; reported_at: Date }>(
      `SELECT id, points, created_at AS reported_at
       FROM pothole_reports
       WHERE driver_id = $1
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
    })),
  };
}

export async function roadCondition() {
  await ensureFleetSchema();
  const pool = getPool();
  const spots = await pool.query<{
    id: string;
    latitude: number;
    longitude: number;
    reported_at: Date;
    photo_id: string;
    first_driver: string;
    drivers: number;
  }>(
    `SELECT p.id, p.latitude, p.longitude, p.created_at AS reported_at,
            first_report.id AS photo_id,
            first_driver.full_name AS first_driver,
            (SELECT COUNT(*)::int FROM pothole_reports r WHERE r.pothole_id = p.id) AS drivers
     FROM potholes p
     JOIN LATERAL (
       SELECT r.id, r.driver_id
       FROM pothole_reports r
       WHERE r.pothole_id = p.id
       ORDER BY r.created_at ASC
       LIMIT 1
     ) first_report ON true
     JOIN drivers first_driver ON first_driver.id = first_report.driver_id
     ORDER BY p.created_at DESC`
  );
  return {
    potholes: spots.rows.map((row): PotholeSpot => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      reportedAt: row.reported_at.toISOString(),
      photoId: row.photo_id,
      firstDriver: row.first_driver,
      drivers: row.drivers,
    })),
  };
}

export async function potholeImage(reportId: string, driverId: string | null) {
  await ensureFleetSchema();
  const { rows } = await getPool().query<{ image: Buffer | null }>(
    `SELECT image FROM pothole_reports
     WHERE id = $1 AND ($2::uuid IS NULL OR driver_id = $2)`,
    [reportId, driverId]
  );
  const image = photoBytes(rows[0]?.image);
  if (image.length === 0) throw new Error("Photo was not found");
  return image;
}
