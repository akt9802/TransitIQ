import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { indiaClockSlot, indiaToday } from "@/lib/company/paper-rules";
import {
  addDays,
  currentKm,
  daysUntil,
  kmLeft,
  serviceIsDue,
  serviceNoticeText,
  serviceOnce,
  servicePushSlot,
  type ServiceView,
} from "@/lib/company/service-rules";
import type { PaperNotice } from "@/lib/company/papers";
import type { ServiceInput } from "@/lib/company/service-input";

export type { ServiceInput };

type ScheduleRow = {
  id: string;
  vehicle_id: string;
  name: string;
  every_days: number | null;
  every_km: string | null;
  next_due_on: string | null;
  next_due_km: string | null;
  last_done_on: string | null;
  skip_trip_id: string | null;
};

function toService(row: ScheduleRow): ServiceView {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    name: row.name,
    everyDays: row.every_days,
    everyKm: row.every_km == null ? null : Number(row.every_km),
    nextDueOn: row.next_due_on,
    nextDueKm: row.next_due_km == null ? null : Number(row.next_due_km),
    lastDoneOn: row.last_done_on,
    skipTripId: row.skip_trip_id,
  };
}

const SCHEDULE_SQL = `
  SELECT s.id, s.vehicle_id, s.name, s.every_days,
         s.every_km::text, to_char(s.next_due_on, 'YYYY-MM-DD') AS next_due_on, s.next_due_km::text, s.skip_trip_id,
         (
           SELECT to_char(d.done_on, 'YYYY-MM-DD')
           FROM service_done d
           WHERE d.schedule_id = s.id
           ORDER BY d.done_on DESC, d.created_at DESC
           LIMIT 1
         ) AS last_done_on
  FROM service_schedules s
`;

export async function listServices(companyId: string): Promise<ServiceView[]> {
  await ensureFleetSchema();
  const { rows } = await getPool().query<ScheduleRow>(
    `${SCHEDULE_SQL}
     WHERE s.company_id = $1 AND s.deleted_at IS NULL
     ORDER BY s.name ASC`,
    [companyId]
  );
  return rows.map(toService);
}

async function ownedVehicle(companyId: string, vehicleId: string) {
  const found = await getPool().query(
    `SELECT 1 FROM vehicles WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [vehicleId, companyId]
  );
  if (!found.rowCount) throw new Error("Choose a truck in this fleet");
}

export async function addService(companyId: string, input: ServiceInput) {
  await ensureFleetSchema();
  await ownedVehicle(companyId, input.vehicleId);
  await getPool().query(
    `INSERT INTO service_schedules
       (company_id, vehicle_id, name, every_days, every_km, next_due_on, next_due_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, input.vehicleId, input.name, input.everyDays, input.everyKm, input.nextDueOn, input.nextDueKm]
  );
}

export async function updateService(companyId: string, id: string, input: ServiceInput) {
  await ensureFleetSchema();
  await ownedVehicle(companyId, input.vehicleId);
  const updated = await getPool().query(
    `UPDATE service_schedules
     SET vehicle_id = $3, name = $4, every_days = $5, every_km = $6, next_due_on = $7, next_due_km = $8,
         skip_trip_id = NULL
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId, input.vehicleId, input.name, input.everyDays, input.everyKm, input.nextDueOn, input.nextDueKm]
  );
  if (updated.rowCount !== 1) throw new Error("That service was not found");
}

export async function removeService(companyId: string, id: string) {
  await ensureFleetSchema();
  const updated = await getPool().query(
    `UPDATE service_schedules SET deleted_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That service was not found");
}

export async function completeService(
  companyId: string,
  id: string,
  doneOn: string,
  odometerKm: number | null
) {
  await ensureFleetSchema();
  const today = indiaToday();
  if (doneOn > today) throw new Error("Done date cannot be in the future");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      vehicle_id: string;
      name: string;
      every_days: number | null;
      every_km: string | null;
      odometer_km: string | null;
      tracked_km: string;
    }>(
      `SELECT s.vehicle_id, s.name, s.every_days, s.every_km::text, v.odometer_km::text, v.tracked_km::text
       FROM service_schedules s
       JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
       FOR UPDATE OF s, v`,
      [id, companyId]
    );
    const row = current.rows[0];
    if (!row) throw new Error("That service was not found");
    const everyKm = row.every_km == null ? null : Number(row.every_km);
    let reading = odometerKm;
    if (reading == null) {
      reading = currentKm(row.odometer_km == null ? null : Number(row.odometer_km), Number(row.tracked_km));
    }
    if (everyKm != null && reading == null) throw new Error("Odometer is required");
    if (reading != null) {
      await client.query(
        `UPDATE vehicles SET odometer_km = $3, tracked_km = 0, updated_at = now()
         WHERE id = $1 AND company_id = $2`,
        [row.vehicle_id, companyId, reading]
      );
    }
    const nextDueOn = row.every_days ? addDays(doneOn, row.every_days) : null;
    const nextDueKm = everyKm != null && reading != null ? Math.round((reading + everyKm) * 10) / 10 : null;
    await client.query(
      `INSERT INTO service_done (company_id, schedule_id, vehicle_id, name, done_on, odometer_km)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, id, row.vehicle_id, row.name, doneOn, reading]
    );
    await client.query(
      `UPDATE service_schedules
       SET next_due_on = $3, next_due_km = $4, skip_trip_id = NULL
       WHERE id = $1 AND company_id = $2`,
      [id, companyId, nextDueOn, nextDueKm]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type DueRow = { id: string; name: string; next_due_on: string | null; next_due_km: string | null; skip_trip_id: string | null };

async function vehicleReading(client: PoolClient, companyId: string, vehicleId: string) {
  const vehicle = await client.query<{ odometer_km: string | null; tracked_km: string }>(
    `SELECT odometer_km::text, tracked_km::text FROM vehicles WHERE id = $1 AND company_id = $2`,
    [vehicleId, companyId]
  );
  return currentKm(
    vehicle.rows[0]?.odometer_km == null ? null : Number(vehicle.rows[0].odometer_km),
    Number(vehicle.rows[0]?.tracked_km ?? 0)
  );
}

function dueRows(rows: DueRow[], reading: number | null, today: string) {
  return rows.filter((service) => {
    const days = service.next_due_on ? daysUntil(service.next_due_on, today) : null;
    const left = kmLeft(service.next_due_km == null ? null : Number(service.next_due_km), reading);
    return serviceIsDue(days, left);
  });
}

export async function assertVehicleServices(client: PoolClient, companyId: string, vehicleId: string, tripId: string | null) {
  const reading = await vehicleReading(client, companyId, vehicleId);
  const services = await client.query<DueRow>(
    `SELECT id, name, to_char(next_due_on, 'YYYY-MM-DD') AS next_due_on, next_due_km::text, skip_trip_id
     FROM service_schedules
     WHERE company_id = $1 AND vehicle_id = $2 AND deleted_at IS NULL`,
    [companyId, vehicleId]
  );
  const today = indiaToday();
  for (const service of dueRows(services.rows, reading, today)) {
    if (tripId && service.skip_trip_id === tripId) continue;
    throw new Error(`You cannot start this trip until the ${service.name} service is done`);
  }
}

export async function releaseTripService(client: PoolClient, companyId: string, tripId: string) {
  await client.query(
    `UPDATE service_schedules SET skip_trip_id = NULL WHERE company_id = $1 AND skip_trip_id = $2`,
    [companyId, tripId]
  );
}

const OPEN_TRIP = `('created', 'assigned', 'started', 'loading', 'in_transit', 'unloading')`;

async function waitingTrip(client: PoolClient, companyId: string, tripId: string) {
  const trip = await client.query<{ status: string; vehicle_id: string | null }>(
    `SELECT status, vehicle_id FROM trips
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
     FOR UPDATE`,
    [tripId, companyId]
  );
  const row = trip.rows[0];
  if (!row) throw new Error("That trip was not found");
  if (row.status !== "created" && row.status !== "assigned") {
    throw new Error("You cannot change this after the trip has started");
  }
  if (!row.vehicle_id) throw new Error("Choose a truck first");
  return row.vehicle_id;
}

export async function deliverTripFirst(companyId: string, tripId: string) {
  await ensureFleetSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vehicleId = await waitingTrip(client, companyId, tripId);
    const reading = await vehicleReading(client, companyId, vehicleId);
    const services = await client.query<DueRow>(
      `SELECT id, name, to_char(next_due_on, 'YYYY-MM-DD') AS next_due_on, next_due_km::text, skip_trip_id
       FROM service_schedules
       WHERE company_id = $1 AND vehicle_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [companyId, vehicleId]
    );
    const due = dueRows(services.rows, reading, indiaToday());
    if (due.length === 0) throw new Error("A service must be due before this trip can go first");
    const held = await client.query(
      `SELECT 1 FROM service_schedules s
       JOIN trips t ON t.id = s.skip_trip_id
       WHERE s.company_id = $1 AND s.vehicle_id = $2 AND s.deleted_at IS NULL
         AND s.skip_trip_id IS NOT NULL AND s.skip_trip_id <> $3
         AND t.deleted_at IS NULL AND t.status IN ${OPEN_TRIP}
       LIMIT 1`,
      [companyId, vehicleId, tripId]
    );
    if ((held.rowCount ?? 0) > 0) throw new Error("Another trip already goes before this service");
    const ids = due.map((service) => service.id);
    await client.query(
      `UPDATE service_schedules SET skip_trip_id = NULL
       WHERE company_id = $1 AND vehicle_id = $2 AND skip_trip_id = $3 AND NOT (id = ANY($4::uuid[]))`,
      [companyId, vehicleId, tripId, ids]
    );
    await client.query(
      `UPDATE service_schedules SET skip_trip_id = $3
       WHERE company_id = $1 AND vehicle_id = $2 AND id = ANY($4::uuid[])`,
      [companyId, vehicleId, tripId, ids]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function oilTripFirst(companyId: string, tripId: string) {
  await ensureFleetSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vehicleId = await waitingTrip(client, companyId, tripId);
    const cleared = await client.query(
      `UPDATE service_schedules SET skip_trip_id = NULL
       WHERE company_id = $1 AND vehicle_id = $2 AND skip_trip_id = $3`,
      [companyId, vehicleId, tripId]
    );
    if ((cleared.rowCount ?? 0) === 0) throw new Error("This trip must be sent first before the service goes first");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function serviceNotices(
  companyId: string,
  claim: boolean,
  vehicleIds: string[] | null,
  href: string,
  now = new Date()
): Promise<{ banner: PaperNotice[]; push: PaperNotice[] }> {
  await ensureFleetSchema();
  if (vehicleIds && vehicleIds.length === 0) return { banner: [], push: [] };
  const today = indiaToday(now);
  const clock = indiaClockSlot(now);
  const pool = getPool();
  const params: unknown[] = [companyId];
  let vehicleSql = "";
  if (vehicleIds) {
    params.push(vehicleIds);
    vehicleSql = `AND s.vehicle_id = ANY($2::uuid[])`;
  }
  const { rows } = await pool.query<{
    id: string;
    vehicle_id: string;
    name: string;
    registration_number: string;
    next_due_on: string | null;
    next_due_km: string | null;
    odometer_km: string | null;
    tracked_km: string;
  }>(
    `SELECT s.id, s.vehicle_id, s.name, v.registration_number,
            to_char(s.next_due_on, 'YYYY-MM-DD') AS next_due_on, s.next_due_km::text,
            v.odometer_km::text, v.tracked_km::text
     FROM service_schedules s
     JOIN vehicles v ON v.id = s.vehicle_id AND v.deleted_at IS NULL
     WHERE s.company_id = $1 AND s.deleted_at IS NULL ${vehicleSql}`,
    params
  );
  const banner: PaperNotice[] = [];
  const due: { key: string; dueOn: string; text: string; href: string; slot: string; days: number | null }[] = [];
  for (const row of rows) {
    const reading = currentKm(row.odometer_km == null ? null : Number(row.odometer_km), Number(row.tracked_km));
    const days = row.next_due_on ? daysUntil(row.next_due_on, today) : null;
    const left = kmLeft(row.next_due_km == null ? null : Number(row.next_due_km), reading);
    const text = serviceNoticeText(row.registration_number, {
      id: row.id,
      vehicleId: "",
      name: row.name,
      everyDays: null,
      everyKm: null,
      nextDueOn: row.next_due_on,
      nextDueKm: row.next_due_km == null ? null : Number(row.next_due_km),
      lastDoneOn: null,
      skipTripId: null,
    }, days, left);
    if (!text) continue;
    const rowHref = href.includes("section=vehicles")
      ? `${href}&vehicle=${row.vehicle_id}&field=service&service=${row.id}`
      : href;
    banner.push({ key: `service:${row.id}`, text, href: rowHref, days: serviceIsDue(days, left) ? 0 : days });
    const slot = servicePushSlot(days, left, clock);
    if (!slot) continue;
    due.push({
      key: `service:${row.id}:${row.next_due_on ?? "-"}:${row.next_due_km ?? "-"}`,
      dueOn: row.next_due_on ?? "2000-01-01",
      text,
      href: rowHref,
      slot,
      days,
    });
  }
  banner.sort((left, right) => (left.days ?? 0.5) - (right.days ?? 0.5));
  const push: PaperNotice[] = [];
  if (claim) {
    for (const item of due) {
      const sentOn = serviceOnce(item.slot) ? "2000-01-01" : today;
      const inserted = await pool.query(
        `INSERT INTO paper_reminder_sends (company_id, subject_key, expires_on, slot, sent_on)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (subject_key, expires_on, slot, sent_on) DO NOTHING
         RETURNING id`,
        [companyId, item.key, item.dueOn, item.slot, sentOn]
      );
      if ((inserted.rowCount ?? 0) > 0) {
        push.push({ key: `${item.key}:${item.slot}:${sentOn}`, text: item.text, href: item.href, days: item.days });
      }
    }
  }
  return { banner, push };
}
