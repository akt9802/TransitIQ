import { createHash, randomBytes } from "crypto";
import { getPool } from "@/lib/db";
import { paperLabel } from "@/lib/company/paper-rules";
import type {
  ApiKeyRecord,
  AttendanceRecord,
  BranchRecord,
  DeviceInput,
  DeviceRecord,
  DriverInput,
  DriverRecord,
  HosRecord,
  NotificationPreference,
  PaperInput,
  PaperRecord,
  PointRecord,
  ShiftRecord,
  SubscriptionRecord,
  VendorRecord,
} from "@/lib/company/types";

function asNumber(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDay(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function asInstant(value: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function owned(table: "branches" | "vendors" | "drivers" | "vehicles", companyId: string, id: string | null) {
  if (!id) return;
  const { rowCount } = await getPool().query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (!rowCount) {
    const label = table === "branches" ? "branch" : table === "vendors" ? "vendor" : table === "drivers" ? "driver" : "vehicle";
    throw new Error(`Choose a ${label} in this fleet`);
  }
}

export async function listBranches(companyId: string): Promise<BranchRecord[]> {
  const { rows } = await getPool().query<{ id: string; name: string; address: string | null }>(
    `SELECT id, name, address FROM branches
     WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [companyId]
  );
  return rows;
}

export async function addBranch(companyId: string, input: { name: string; address: string | null }) {
  await getPool().query(
    `INSERT INTO branches (company_id, name, address) VALUES ($1, $2, $3)`,
    [companyId, input.name, input.address]
  );
}

export async function updateBranch(companyId: string, id: string, input: { name: string; address: string | null }) {
  const updated = await getPool().query(
    `UPDATE branches SET name = $3, address = $4, updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId, input.name, input.address]
  );
  if (updated.rowCount !== 1) throw new Error("That branch was not found");
}

export async function removeBranch(companyId: string, id: string) {
  const used = await getPool().query(
    `SELECT 1 FROM vehicles WHERE branch_id = $1 AND company_id = $2 AND deleted_at IS NULL
     UNION ALL
     SELECT 1 FROM drivers WHERE branch_id = $1 AND company_id = $2 AND deleted_at IS NULL
     UNION ALL
     SELECT 1 FROM fleet_users WHERE branch_id = $1 AND company_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [id, companyId]
  );
  if ((used.rowCount ?? 0) > 0) throw new Error("This branch is already in use");
  const updated = await getPool().query(
    `UPDATE branches SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That branch was not found");
}

export async function listVendors(companyId: string): Promise<VendorRecord[]> {
  const { rows } = await getPool().query<VendorRecord & { gstin: string | null }>(
    `SELECT id, name, phone, gstin FROM vendors
     WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [companyId]
  );
  return rows;
}

export async function addVendor(companyId: string, input: { name: string; phone: string | null; gstin: string | null }) {
  await getPool().query(
    `INSERT INTO vendors (company_id, name, phone, gstin) VALUES ($1, $2, $3, $4)`,
    [companyId, input.name, input.phone, input.gstin]
  );
}

export async function updateVendor(
  companyId: string,
  id: string,
  input: { name: string; phone: string | null; gstin: string | null }
) {
  const updated = await getPool().query(
    `UPDATE vendors SET name = $3, phone = $4, gstin = $5, updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId, input.name, input.phone, input.gstin]
  );
  if (updated.rowCount !== 1) throw new Error("That vendor was not found");
}

export async function removeVendor(companyId: string, id: string) {
  const used = await getPool().query(
    `SELECT 1 FROM vehicles WHERE vendor_id = $1 AND company_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [id, companyId]
  );
  if ((used.rowCount ?? 0) > 0) throw new Error("This vendor is already in use");
  const updated = await getPool().query(
    `UPDATE vendors SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That vendor was not found");
}

type DriverRow = {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  branch_id: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  license_number: string | null;
  license_class: string | null;
  license_expires_on: Date | string | null;
  license_endorsements: string | null;
  pay_type: string;
  pay_rate: string | number | null;
  status: string;
  user_id: string | null;
};

function toDriver(row: DriverRow): DriverRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    branchId: row.branch_id,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    licenseNumber: row.license_number,
    licenseClass: row.license_class,
    licenseExpiresOn: asDay(row.license_expires_on),
    licenseEndorsements: row.license_endorsements,
    payType: row.pay_type,
    payRate: asNumber(row.pay_rate),
    status: row.status,
    userId: row.user_id,
  };
}

const DRIVER_SELECT = `
  SELECT d.id, d.full_name, d.phone, d.address, d.branch_id, d.emergency_name, d.emergency_phone,
         d.license_number, d.license_class, d.license_expires_on, d.license_endorsements,
         d.pay_type, d.pay_rate, d.status, u.id AS user_id
  FROM drivers d
  LEFT JOIN fleet_users u ON u.driver_id = d.id AND u.deleted_at IS NULL
`;

async function syncLoginDrivers(companyId: string) {
  const pool = getPool();
  const missing = await pool.query<{
    id: string;
    full_name: string | null;
    phone: string | null;
    branch_id: string | null;
  }>(
    `SELECT u.id, u.full_name, u.phone, u.branch_id
     FROM fleet_users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.company_id = $1 AND u.deleted_at IS NULL AND r.key = 'driver' AND u.driver_id IS NULL`,
    [companyId]
  );
  for (const user of missing.rows) {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO drivers (company_id, branch_id, full_name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        companyId,
        user.branch_id,
        user.full_name?.trim() || "Driver",
        user.phone?.trim() || "Not added",
      ]
    );
    const driverId = inserted.rows[0]?.id;
    if (!driverId) continue;
    const linked = await pool.query(
      `UPDATE fleet_users SET driver_id = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND driver_id IS NULL`,
      [user.id, companyId, driverId]
    );
    if (linked.rowCount !== 1) {
      await pool.query(`UPDATE drivers SET deleted_at = now() WHERE id = $1`, [driverId]);
    }
  }
}

export async function listDrivers(companyId: string): Promise<DriverRecord[]> {
  await syncLoginDrivers(companyId);
  const { rows } = await getPool().query<DriverRow>(
    `${DRIVER_SELECT}
     LEFT JOIN roles ur ON ur.id = u.role_id
     WHERE d.company_id = $1 AND d.deleted_at IS NULL
       AND (u.id IS NULL OR ur.key = 'driver')
     ORDER BY d.full_name ASC`,
    [companyId]
  );
  return rows.map(toDriver);
}

async function linkDriver(companyId: string, driverId: string, userId: string | null) {
  const pool = getPool();
  if (userId) {
    const user = await pool.query<{ key: string | null }>(
      `SELECT r.key FROM fleet_users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL`,
      [userId, companyId]
    );
    if (user.rows[0]?.key !== "driver") throw new Error("Only a driver login can be linked");
  }
  await pool.query(
    `UPDATE fleet_users SET driver_id = NULL, updated_at = now()
     WHERE company_id = $1 AND driver_id = $2`,
    [companyId, driverId]
  );
  if (userId) {
    await pool.query(
      `UPDATE fleet_users SET driver_id = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [userId, companyId, driverId]
    );
  }
}

export async function addDriver(companyId: string, input: DriverInput) {
  await owned("branches", companyId, input.branchId);
  const inserted = await getPool().query<{ id: string }>(
    `INSERT INTO drivers (
       company_id, branch_id, full_name, phone, address, emergency_name, emergency_phone,
       license_number, license_class, license_expires_on, license_endorsements, pay_type, pay_rate, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      companyId,
      input.branchId,
      input.fullName,
      input.phone,
      input.address,
      input.emergencyName,
      input.emergencyPhone,
      input.licenseNumber,
      input.licenseClass,
      input.licenseExpiresOn,
      input.licenseEndorsements,
      input.payType,
      input.payRate,
      input.status,
    ]
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new Error("Could not add the driver");
  await linkDriver(companyId, id, input.userId);
}

export async function updateDriver(companyId: string, id: string, input: DriverInput) {
  await owned("branches", companyId, input.branchId);
  await owned("drivers", companyId, id);
  const updated = await getPool().query(
    `UPDATE drivers SET
       branch_id = $3, full_name = $4, phone = $5, address = $6, emergency_name = $7, emergency_phone = $8,
       license_number = $9, license_class = $10, license_expires_on = $11, license_endorsements = $12,
       pay_type = $13, pay_rate = $14, status = $15, updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [
      id,
      companyId,
      input.branchId,
      input.fullName,
      input.phone,
      input.address,
      input.emergencyName,
      input.emergencyPhone,
      input.licenseNumber,
      input.licenseClass,
      input.licenseExpiresOn,
      input.licenseEndorsements,
      input.payType,
      input.payRate,
      input.status,
    ]
  );
  if (updated.rowCount !== 1) throw new Error("That driver was not found");
  await linkDriver(companyId, id, input.userId);
}

export async function removeDriver(companyId: string, id: string) {
  await linkDriver(companyId, id, null);
  const updated = await getPool().query(
    `UPDATE drivers SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That driver was not found");
}

type PaperRow = {
  id: string;
  parent_id: string;
  kind: string;
  document_number: string | null;
  file_key: string | null;
  issued_on: Date | string | null;
  expires_on: Date | string | null;
};

function toPaper(row: PaperRow): PaperRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    documentNumber: row.document_number,
    fileKey: row.file_key,
    issuedOn: asDay(row.issued_on),
    expiresOn: asDay(row.expires_on),
  };
}

export async function listVehiclePapers(companyId: string): Promise<PaperRecord[]> {
  const { rows } = await getPool().query<PaperRow>(
    `SELECT id, vehicle_id AS parent_id, kind, document_number, file_key, issued_on, expires_on
     FROM vehicle_documents
     WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY expires_on NULLS LAST`,
    [companyId]
  );
  return rows.map(toPaper);
}

export async function addVehiclePaper(companyId: string, input: PaperInput) {
  await owned("vehicles", companyId, input.parentId);
  await getPool().query(
    `INSERT INTO vehicle_documents (company_id, vehicle_id, kind, document_number, file_key, issued_on, expires_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [companyId, input.parentId, input.kind, input.documentNumber, input.fileKey, input.issuedOn, input.expiresOn]
  );
}

export async function updateVehiclePaper(
  companyId: string,
  id: string,
  input: { documentNumber: string | null; expiresOn: string | null }
) {
  const current = await getPool().query<{ kind: string }>(
    `SELECT kind FROM vehicle_documents WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  const kind = current.rows[0]?.kind;
  if (!kind) throw new Error("That paper was not found");
  if (["insurance", "permit", "fitness", "pollution"].includes(kind) && !input.expiresOn) {
    throw new Error(`${paperLabel(kind)} expiry is required`);
  }
  const updated = await getPool().query(
    `UPDATE vehicle_documents SET document_number = $3, expires_on = $4
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId, input.documentNumber, input.expiresOn]
  );
  if (updated.rowCount !== 1) throw new Error("That paper was not found");
}

export async function removeVehiclePaper(companyId: string, id: string) {
  const current = await getPool().query<{ kind: string }>(
    `SELECT kind FROM vehicle_documents WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  const kind = current.rows[0]?.kind;
  if (!kind) throw new Error("That paper was not found");
  if (["rc", "insurance", "permit", "fitness", "pollution"].includes(kind)) {
    throw new Error(`You cannot delete ${paperLabel(kind)}. Change the date on the truck.`);
  }
  const updated = await getPool().query(
    `UPDATE vehicle_documents SET deleted_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That paper was not found");
}

export async function listDriverPapers(companyId: string): Promise<PaperRecord[]> {
  const { rows } = await getPool().query<PaperRow>(
    `SELECT id, driver_id AS parent_id, kind, document_number, file_key, NULL::date AS issued_on, expires_on
     FROM driver_documents
     WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY expires_on NULLS LAST`,
    [companyId]
  );
  return rows.map(toPaper);
}

export async function addDriverPaper(companyId: string, input: PaperInput) {
  await owned("drivers", companyId, input.parentId);
  await getPool().query(
    `INSERT INTO driver_documents (company_id, driver_id, kind, document_number, file_key, expires_on)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [companyId, input.parentId, input.kind, input.documentNumber, input.fileKey, input.expiresOn]
  );
}

export async function updateDriverPaper(
  companyId: string,
  id: string,
  input: { documentNumber: string | null; expiresOn: string | null }
) {
  const updated = await getPool().query(
    `UPDATE driver_documents SET document_number = $3, expires_on = $4
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId, input.documentNumber, input.expiresOn]
  );
  if (updated.rowCount !== 1) throw new Error("That paper was not found");
}

export async function removeDriverPaper(companyId: string, id: string) {
  const updated = await getPool().query(
    `UPDATE driver_documents SET deleted_at = now()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That paper was not found");
}

export async function listDevices(companyId: string): Promise<DeviceRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    kind: string;
    external_id: string;
    vehicle_id: string | null;
    driver_id: string | null;
    last_seen_at: Date | string | null;
  }>(
    `SELECT id, kind, external_id, vehicle_id, driver_id, last_seen_at
     FROM devices WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY external_id ASC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    externalId: row.external_id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    lastSeenAt: asInstant(row.last_seen_at),
  }));
}

export async function addDevice(companyId: string, input: DeviceInput) {
  await owned("vehicles", companyId, input.vehicleId);
  await owned("drivers", companyId, input.driverId);
  try {
    await getPool().query(
      `INSERT INTO devices (company_id, vehicle_id, driver_id, kind, external_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [companyId, input.vehicleId, input.driverId, input.kind, input.externalId]
    );
  } catch (error) {
    if (isUnique(error)) throw new Error("This tracker id is already in use");
    throw error;
  }
}

export async function updateDevice(companyId: string, id: string, input: DeviceInput) {
  await owned("vehicles", companyId, input.vehicleId);
  await owned("drivers", companyId, input.driverId);
  try {
    const updated = await getPool().query(
      `UPDATE devices SET vehicle_id = $3, driver_id = $4, kind = $5, external_id = $6
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId, input.vehicleId, input.driverId, input.kind, input.externalId]
    );
    if (updated.rowCount !== 1) throw new Error("That tracker was not found");
  } catch (error) {
    if (isUnique(error)) throw new Error("This tracker id is already in use");
    throw error;
  }
}

export async function removeDevice(companyId: string, id: string) {
  const updated = await getPool().query(
    `UPDATE devices SET deleted_at = now() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That tracker was not found");
}

export async function listShifts(companyId: string): Promise<ShiftRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    driver_id: string;
    vehicle_id: string | null;
    starts_at: Date;
    ends_at: Date;
  }>(
    `SELECT id, driver_id, vehicle_id, starts_at, ends_at
     FROM driver_shifts WHERE company_id = $1 ORDER BY starts_at DESC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    startsAt: asInstant(row.starts_at) ?? "",
    endsAt: asInstant(row.ends_at) ?? "",
  }));
}

export async function addShift(
  companyId: string,
  input: { driverId: string; vehicleId: string | null; startsAt: string; endsAt: string }
) {
  await owned("drivers", companyId, input.driverId);
  await owned("vehicles", companyId, input.vehicleId);
  await getPool().query(
    `INSERT INTO driver_shifts (company_id, driver_id, vehicle_id, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [companyId, input.driverId, input.vehicleId, input.startsAt, input.endsAt]
  );
}

export async function removeShift(companyId: string, id: string) {
  const updated = await getPool().query(`DELETE FROM driver_shifts WHERE id = $1 AND company_id = $2`, [id, companyId]);
  if (updated.rowCount !== 1) throw new Error("That shift was not found");
}

export async function listAttendance(companyId: string): Promise<AttendanceRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    driver_id: string;
    day: Date | string;
    kind: string;
    note: string | null;
  }>(
    `SELECT id, driver_id, day, kind, note FROM driver_attendance
     WHERE company_id = $1 ORDER BY day DESC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    day: asDay(row.day) ?? "",
    kind: row.kind,
    note: row.note,
  }));
}

export async function addAttendance(
  companyId: string,
  input: { driverId: string; day: string; kind: string; note: string | null }
) {
  await owned("drivers", companyId, input.driverId);
  try {
    await getPool().query(
      `INSERT INTO driver_attendance (company_id, driver_id, day, kind, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [companyId, input.driverId, input.day, input.kind, input.note]
    );
  } catch (error) {
    if (isUnique(error)) throw new Error("Attendance for this driver and day already exists");
    throw error;
  }
}

export async function removeAttendance(companyId: string, id: string) {
  const updated = await getPool().query(`DELETE FROM driver_attendance WHERE id = $1 AND company_id = $2`, [id, companyId]);
  if (updated.rowCount !== 1) throw new Error("That attendance row was not found");
}

export async function listHos(companyId: string): Promise<HosRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    driver_id: string;
    kind: string;
    started_at: Date;
    ended_at: Date | null;
  }>(
    `SELECT id, driver_id, kind, started_at, ended_at FROM hos_logs
     WHERE company_id = $1 ORDER BY started_at DESC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    kind: row.kind,
    startedAt: asInstant(row.started_at) ?? "",
    endedAt: asInstant(row.ended_at),
  }));
}

export async function addHos(
  companyId: string,
  input: { driverId: string; kind: string; startedAt: string; endedAt: string | null }
) {
  await owned("drivers", companyId, input.driverId);
  await getPool().query(
    `INSERT INTO hos_logs (company_id, driver_id, kind, started_at, ended_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [companyId, input.driverId, input.kind, input.startedAt, input.endedAt]
  );
}

export async function removeHos(companyId: string, id: string) {
  const updated = await getPool().query(`DELETE FROM hos_logs WHERE id = $1 AND company_id = $2`, [id, companyId]);
  if (updated.rowCount !== 1) throw new Error("That hours row was not found");
}

export async function listPoints(companyId: string): Promise<PointRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    driver_id: string;
    points: number;
    reason: string;
    source_type: string | null;
    created_at: Date;
  }>(
    `SELECT id, driver_id, points, reason, source_type, created_at
     FROM driver_point_events WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    points: row.points,
    reason: row.reason,
    sourceType: row.source_type,
    createdAt: asInstant(row.created_at) ?? "",
  }));
}

export async function addPoints(
  companyId: string,
  input: { driverId: string; points: number; reason: string; sourceType: string | null }
) {
  await owned("drivers", companyId, input.driverId);
  await getPool().query(
    `INSERT INTO driver_point_events (company_id, driver_id, points, reason, source_type)
     VALUES ($1,$2,$3,$4,$5)`,
    [companyId, input.driverId, input.points, input.reason, input.sourceType]
  );
}

export async function removePoints(companyId: string, id: string) {
  const updated = await getPool().query(
    `DELETE FROM driver_point_events WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That points row was not found");
}

export async function getSubscription(companyId: string): Promise<SubscriptionRecord | null> {
  const { rows } = await getPool().query<{ plan: string; status: string; vehicle_limit: number }>(
    `SELECT plan, status, vehicle_limit FROM subscriptions
     WHERE company_id = $1 AND status <> 'canceled'
     ORDER BY created_at DESC LIMIT 1`,
    [companyId]
  );
  const row = rows[0];
  if (!row) return null;
  return { plan: row.plan, status: row.status, vehicleLimit: row.vehicle_limit };
}

export async function listApiKeys(companyId: string): Promise<ApiKeyRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, name, created_at, last_used_at, revoked_at
     FROM api_keys WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: asInstant(row.created_at) ?? "",
    lastUsedAt: asInstant(row.last_used_at),
    revokedAt: asInstant(row.revoked_at),
  }));
}

export async function createApiKey(companyId: string, name: string): Promise<string> {
  const secret = `tiq_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(secret).digest("hex");
  await getPool().query(
    `INSERT INTO api_keys (company_id, name, key_hash) VALUES ($1, $2, $3)`,
    [companyId, name, keyHash]
  );
  return secret;
}

export async function revokeApiKey(companyId: string, id: string) {
  const updated = await getPool().query(
    `UPDATE api_keys SET revoked_at = now()
     WHERE id = $1 AND company_id = $2 AND revoked_at IS NULL`,
    [id, companyId]
  );
  if (updated.rowCount !== 1) throw new Error("That key was not found");
}

export async function listNotifications(userId: string): Promise<NotificationPreference[]> {
  const { rows } = await getPool().query<NotificationPreference>(
    `SELECT kind, channel, enabled FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );
  return rows;
}

export async function saveNotifications(userId: string, items: NotificationPreference[]) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
    for (const item of items) {
      await client.query(
        `INSERT INTO notification_preferences (user_id, kind, channel, enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, kind, channel) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [userId, item.kind, item.channel, item.enabled]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}
