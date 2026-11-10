import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import {
  REQUIRED_VEHICLE_EXPIRY,
  daysUntil,
  expiryPhrase,
  indiaClockSlot,
  indiaToday,
  paperLabel,
  pushSlot,
  type PaperSnapshot,
} from "@/lib/company/paper-rules";

export type VehiclePaperDraft = {
  kind: string;
  documentNumber: string | null;
  expiresOn: string | null;
};

export type PaperNotice = {
  key: string;
  text: string;
  href: string;
  days: number | null;
};

const ACTIVE_DRIVER = new Set(["active", "on_leave"]);

function driverHref(id: string, field: string) {
  return `/dashboard?section=drivers&driver=${id}&field=${field}`;
}

function vehicleHref(id: string, field: string) {
  return `/dashboard?section=vehicles&vehicle=${id}&field=${field}`;
}

export function assertActiveVehiclePapers(status: string, papers: VehiclePaperDraft[]) {
  if (status !== "active") return;
  const byKind = new Map(papers.map((paper) => [paper.kind, paper]));
  for (const kind of REQUIRED_VEHICLE_EXPIRY) {
    if (!byKind.get(kind)?.expiresOn) {
      throw new Error(`${paperLabel(kind)} expiry is required`);
    }
  }
  if (!byKind.get("rc")?.documentNumber?.trim()) {
    throw new Error("RC number is required");
  }
}

export async function writeVehiclePapers(
  client: PoolClient,
  companyId: string,
  vehicleId: string,
  papers: VehiclePaperDraft[]
) {
  for (const paper of papers) {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM vehicle_documents
       WHERE company_id = $1 AND vehicle_id = $2 AND kind = $3 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [companyId, vehicleId, paper.kind]
    );
    const keep = existing.rows[0];
    const extra = existing.rows.slice(1).map((row) => row.id);
    if (extra.length > 0) {
      await client.query(`UPDATE vehicle_documents SET deleted_at = now() WHERE id = ANY($1::uuid[])`, [extra]);
    }
    if (keep) {
      await client.query(
        `UPDATE vehicle_documents
         SET document_number = $2, expires_on = $3
         WHERE id = $1`,
        [keep.id, paper.documentNumber, paper.expiresOn]
      );
      continue;
    }
    if (!paper.documentNumber && !paper.expiresOn) continue;
    await client.query(
      `INSERT INTO vehicle_documents (company_id, vehicle_id, kind, document_number, expires_on)
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, vehicleId, paper.kind, paper.documentNumber, paper.expiresOn]
    );
  }
}

export async function assertTripPapers(
  client: PoolClient,
  companyId: string,
  driverId: string,
  vehicleId: string
) {
  const driver = await client.query<{ missing: boolean; expired: boolean }>(
    `SELECT
       (license_number IS NULL OR btrim(license_number) = '' OR license_expires_on IS NULL) AS missing,
       (license_expires_on IS NOT NULL AND license_expires_on < (timezone('Asia/Kolkata', now()))::date) AS expired
     FROM drivers
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [driverId, companyId]
  );
  const licence = driver.rows[0];
  if (!licence) throw new Error("Choose a driver in this fleet");
  if (licence.expired) throw new Error("This driver's licence has expired");
  if (licence.missing) throw new Error("This driver's licence is missing");

  const driverPaper = await client.query(
    `SELECT 1 FROM driver_documents
     WHERE driver_id = $1 AND company_id = $2 AND deleted_at IS NULL
       AND expires_on < (timezone('Asia/Kolkata', now()))::date
     LIMIT 1`,
    [driverId, companyId]
  );
  if ((driverPaper.rowCount ?? 0) > 0) throw new Error("This driver has an expired document");

  const docs = await client.query<{
    kind: string;
    document_number: string | null;
    expires_on: string | null;
    expired: boolean;
  }>(
    `SELECT kind, document_number, to_char(expires_on, 'YYYY-MM-DD') AS expires_on,
            (expires_on IS NOT NULL AND expires_on < (timezone('Asia/Kolkata', now()))::date) AS expired
     FROM vehicle_documents
     WHERE vehicle_id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [vehicleId, companyId]
  );
  const rows = docs.rows;
  for (const row of rows) {
    if (!row.expired) continue;
    throw new Error(`This truck's ${paperLabel(row.kind)} has expired`);
  }
  for (const kind of REQUIRED_VEHICLE_EXPIRY) {
    const valid = rows.some((row) => row.kind === kind && row.expires_on && !row.expired);
    if (!valid) throw new Error(`This truck is missing ${paperLabel(kind)}`);
  }
  const rc = rows.some((row) => row.kind === "rc" && row.document_number?.trim());
  if (!rc) throw new Error("This truck is missing RC");
}

type DatedPaper = {
  key: string;
  expiresOn: string;
  text: string;
  href: string;
  days: number;
};

export async function paperNotices(companyId: string, claim: boolean, now = new Date()) {
  await ensureFleetSchema();
  const today = indiaToday(now);
  const clock = indiaClockSlot(now);
  const pool = getPool();
  const [vehicles, vehiclePapers, drivers, driverPapers] = await Promise.all([
    pool.query<{ id: string; registration_number: string; status: string }>(
      `SELECT id, registration_number, status FROM vehicles
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    ),
    pool.query<{ id: string; vehicle_id: string; kind: string; document_number: string | null; expires_on: string | null }>(
      `SELECT id, vehicle_id, kind, document_number, to_char(expires_on, 'YYYY-MM-DD') AS expires_on
       FROM vehicle_documents
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    ),
    pool.query<{ id: string; full_name: string; status: string; license_expires_on: string | null; license_number: string | null }>(
      `SELECT id, full_name, status, to_char(license_expires_on, 'YYYY-MM-DD') AS license_expires_on, license_number
       FROM drivers
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    ),
    pool.query<{ id: string; driver_id: string; kind: string; expires_on: string | null }>(
      `SELECT id, driver_id, kind, to_char(expires_on, 'YYYY-MM-DD') AS expires_on
       FROM driver_documents
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    ),
  ]);

  const vehicleName = new Map(vehicles.rows.map((row) => [row.id, row]));
  const driverName = new Map(drivers.rows.map((row) => [row.id, row]));
  const papersByVehicle = new Map<string, PaperSnapshot[]>();
  const banner: PaperNotice[] = [];
  const due: DatedPaper[] = [];

  function watch(item: DatedPaper) {
    if (item.days <= 30) banner.push({ key: item.key, text: item.text, href: item.href, days: item.days });
    if (pushSlot(item.days, clock)) due.push(item);
  }

  for (const paper of vehiclePapers.rows) {
    const vehicle = vehicleName.get(paper.vehicle_id);
    if (!vehicle) continue;
    const list = papersByVehicle.get(paper.vehicle_id) ?? [];
    list.push({ kind: paper.kind, documentNumber: paper.document_number, expiresOn: paper.expires_on });
    papersByVehicle.set(paper.vehicle_id, list);
    if (!paper.expires_on) continue;
    const days = daysUntil(paper.expires_on, today);
    const name = vehicle.registration_number;
    watch({
      key: `vehicle:${paper.id}`,
      expiresOn: paper.expires_on,
      days,
      href: vehicleHref(vehicle.id, paper.kind),
      text: `${name} ${paperLabel(paper.kind)} ${expiryPhrase(days, paper.expires_on)}. Update the date on the truck.`,
    });
  }

  for (const vehicle of vehicles.rows) {
    if (vehicle.status !== "active") continue;
    const rows = papersByVehicle.get(vehicle.id) ?? [];
    for (const kind of REQUIRED_VEHICLE_EXPIRY) {
      if (rows.some((row) => row.kind === kind && row.expiresOn)) continue;
      banner.push({
        key: `missing:${vehicle.id}:${kind}`,
        href: vehicleHref(vehicle.id, kind),
        days: null,
        text: `${vehicle.registration_number} ${paperLabel(kind)} is not added. Add the expiry before the next trip.`,
      });
    }
    if (!rows.some((row) => row.kind === "rc" && row.documentNumber?.trim())) {
      banner.push({
        key: `missing:${vehicle.id}:rc`,
        href: vehicleHref(vehicle.id, "rc"),
        days: null,
        text: `${vehicle.registration_number} RC is not added. Add the number before the next trip.`,
      });
    }
  }

  for (const driver of drivers.rows) {
    const licenceNumber = driver.license_number?.trim();
    if (driver.license_expires_on) {
      const days = daysUntil(driver.license_expires_on, today);
      watch({
        key: `license:${driver.id}`,
        expiresOn: driver.license_expires_on,
        days,
        href: driverHref(driver.id, "license"),
        text: `${driver.full_name}'s licence ${expiryPhrase(days, driver.license_expires_on)}. Update the date on the driver.`,
      });
    }
    if (ACTIVE_DRIVER.has(driver.status) && (!driver.license_expires_on || !licenceNumber)) {
      banner.push({
        key: `missing:license:${driver.id}`,
        href: driverHref(driver.id, "license"),
        days: null,
        text: driver.license_expires_on
          ? `${driver.full_name}'s licence number is not added. Add it before the next trip.`
          : `${driver.full_name}'s licence is not added. Add the number and expiry before the next trip.`,
      });
    }
  }

  for (const paper of driverPapers.rows) {
    const driver = driverName.get(paper.driver_id);
    if (!driver || !paper.expires_on) continue;
    const days = daysUntil(paper.expires_on, today);
    watch({
      key: `driver-paper:${paper.id}`,
      expiresOn: paper.expires_on,
      days,
      href: driverHref(driver.id, "papers"),
      text: `${driver.full_name}'s ${paperLabel(paper.kind)} ${expiryPhrase(days, paper.expires_on)}. Update the date on the driver.`,
    });
  }

  banner.sort((left, right) => (left.days ?? 0.5) - (right.days ?? 0.5));

  const push: PaperNotice[] = [];
  if (claim) {
    for (const item of due) {
      const slot = pushSlot(item.days, clock);
      if (!slot) continue;
      const inserted = await pool.query(
        `INSERT INTO paper_reminder_sends (company_id, subject_key, expires_on, slot, sent_on)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (subject_key, expires_on, slot, sent_on) DO NOTHING
         RETURNING id`,
        [companyId, item.key, item.expiresOn, slot, today]
      );
      if ((inserted.rowCount ?? 0) > 0) {
        push.push({ key: `${item.key}:${slot}:${today}`, text: item.text, href: item.href, days: item.days });
      }
    }
  }

  return { banner, push };
}
