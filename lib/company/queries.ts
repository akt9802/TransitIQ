import { getPool } from "@/lib/db";
import {
  getSubscription,
  listDriverPapers,
  listDrivers,
  listVehiclePapers,
} from "@/lib/company/records";
import { listServices } from "@/lib/company/services";
import { listCustomers, listTrips } from "@/lib/company/trips";
import type {
  CompanyInput,
  CompanyRecord,
  PersonRecord,
  VehicleRecord,
  Workspace,
} from "@/lib/company/types";

type FleetLists = Pick<
  Workspace,
  | "branches"
  | "vendors"
  | "drivers"
  | "vehiclePapers"
  | "driverPapers"
  | "devices"
  | "shifts"
  | "attendance"
  | "hosLogs"
  | "pointEvents"
  | "subscription"
  | "apiKeys"
  | "customers"
  | "trips"
  | "services"
>;

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  language: string | null;
  company_id: string | null;
  role_key: string | null;
  role_name: string | null;
  driver_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  plan: string;
  vehicle_limit: number;
};

function toCompany(row: CompanyRow): CompanyRecord {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    gstin: row.gstin,
    phone: row.phone,
    email: row.email,
    address: row.address,
    plan: row.plan,
    vehicleLimit: row.vehicle_limit,
  };
}

export async function getWorkspace(userId: string): Promise<Workspace | null> {
  const pool = getPool();
  const { rows } = await pool.query<OwnerRow>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.address, u.language, u.company_id, u.driver_id,
            r.key AS role_key, r.name AS role_name
     FROM fleet_users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  const owner = rows[0];
  if (!owner) return null;

  let company: CompanyRecord | null = null;
  let people: PersonRecord[] = [];
  let vehicles: VehicleRecord[] = [];
  const emptyFleet: FleetLists = {
    branches: [],
    vendors: [],
    drivers: [],
    vehiclePapers: [],
    driverPapers: [],
    devices: [],
    shifts: [],
    attendance: [],
    hosLogs: [],
    pointEvents: [],
    subscription: null,
    apiKeys: [],
    customers: [],
    trips: [],
    services: [],
  };
  let fleet = emptyFleet;
  if (owner.company_id && owner.role_key !== "road_authority") {
    const companyResult = await pool.query<CompanyRow>(
      `SELECT id, name, legal_name, gstin, phone, email, address, plan, vehicle_limit
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [owner.company_id]
    );
    company = companyResult.rows[0] ? toCompany(companyResult.rows[0]) : null;

    const peopleResult = await pool.query<{
      id: string;
      full_name: string | null;
      email: string;
      phone: string | null;
      role_key: string | null;
      role_name: string | null;
      has_login: boolean;
      branch_id: string | null;
      branch_name: string | null;
    }>(
      `SELECT u.id, u.full_name, u.email, u.phone, r.key AS role_key, r.name AS role_name,
              (u.password_hash IS NOT NULL) AS has_login, u.branch_id, b.name AS branch_name
       FROM fleet_users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN branches b ON b.id = u.branch_id AND b.deleted_at IS NULL
       WHERE u.company_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`,
      [owner.company_id]
    );
    people = peopleResult.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      roleKey: row.role_key,
      roleName: row.role_name,
      hasLogin: row.has_login,
      branchId: row.branch_id,
      branchName: row.branch_name,
    }));
    vehicles = await listVehicles(owner.company_id);
    const companyId = owner.company_id;
    fleet = {
      branches: [],
      vendors: [],
      drivers: await listDrivers(companyId),
      vehiclePapers: await listVehiclePapers(companyId),
      driverPapers: await listDriverPapers(companyId),
      devices: [],
      shifts: [],
      attendance: [],
      hosLogs: [],
      pointEvents: [],
      subscription: await getSubscription(companyId),
      apiKeys: [],
      customers: await listCustomers(companyId),
      trips: owner.role_key === "driver" && !owner.driver_id
        ? []
        : await listTrips(companyId, owner.role_key === "driver" ? owner.driver_id : null),
      services: await listServices(companyId),
    };
  }

  const permissionResult = await pool.query<{ key: string }>(
    `SELECT p.key
     FROM fleet_users u
     JOIN role_permissions rp ON rp.role_id = u.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = $1
     ORDER BY p.key`,
    [userId]
  );

  return {
    owner: {
      id: owner.id,
      email: owner.email,
      fullName: owner.full_name,
      phone: owner.phone,
      address: owner.address,
      language: owner.language === "hi" ? "hi" : "en",
      roleKey: owner.role_key,
      roleName: owner.role_name,
      driverId: owner.driver_id,
    },
    company,
    people,
    vehicles,
    ...fleet,
    notifications: [],
    permissions: permissionResult.rows.map((row) => row.key),
  };
}

type VehicleRow = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  truck_type: string;
  load_capacity_kg: string | number | null;
  axle_count: number | null;
  length_m: string | number | null;
  width_m: string | number | null;
  height_m: string | number | null;
  ownership: string;
  contract_start: Date | string | null;
  contract_end: Date | string | null;
  status: string;
  odometer_km: string | number | null;
  tracked_km: string | number | null;
  tank_capacity_l: string | number | null;
  branch_id: string | null;
  branch_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
};

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

export function toVehicle(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    make: row.make,
    model: row.model,
    year: row.year,
    chassisNumber: row.chassis_number,
    engineNumber: row.engine_number,
    truckType: row.truck_type,
    loadCapacityKg: asNumber(row.load_capacity_kg),
    axleCount: row.axle_count,
    lengthM: asNumber(row.length_m),
    widthM: asNumber(row.width_m),
    heightM: asNumber(row.height_m),
    ownership: row.ownership,
    contractStart: asDay(row.contract_start),
    contractEnd: asDay(row.contract_end),
    status: row.status,
    odometerKm: asNumber(row.odometer_km),
    trackedKm: asNumber(row.tracked_km) ?? 0,
    tankCapacityL: asNumber(row.tank_capacity_l),
    branchId: row.branch_id,
    branchName: row.branch_name,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
  };
}

export async function listVehicles(companyId: string): Promise<VehicleRecord[]> {
  const pool = getPool();
  const { rows } = await pool.query<VehicleRow>(
    `SELECT v.id, v.registration_number, v.make, v.model, v.year, v.chassis_number, v.engine_number,
            v.truck_type, v.load_capacity_kg, v.axle_count, v.length_m, v.width_m, v.height_m,
            v.ownership, v.contract_start, v.contract_end, v.status, v.odometer_km, v.tracked_km, v.tank_capacity_l,
            v.branch_id, b.name AS branch_name, v.vendor_id, vn.name AS vendor_name
     FROM vehicles v
     LEFT JOIN branches b ON b.id = v.branch_id AND b.deleted_at IS NULL
     LEFT JOIN vendors vn ON vn.id = v.vendor_id AND vn.deleted_at IS NULL
     WHERE v.company_id = $1 AND v.deleted_at IS NULL
     ORDER BY v.registration_number ASC`,
    [companyId]
  );
  return rows.map(toVehicle);
}

export async function createFleet(
  userId: string,
  input: CompanyInput
): Promise<"created" | "exists" | "authority"> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO companies (kind, name, legal_name, gstin, phone, email, address)
       VALUES ('fleet', $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.companyName,
        input.legalName,
        input.gstin,
        input.companyPhone,
        input.companyEmail,
        input.companyAddress,
      ]
    );
    const companyId = inserted.rows[0]?.id;
    if (!companyId) throw new Error("Could not create the fleet");

    const role = await client.query<{ id: string }>(
      `SELECT id FROM roles WHERE key = 'owner'`
    );
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error("Owner role is missing");

    const roleNow = await client.query<{ key: string | null }>(
      `SELECT r.key
       FROM fleet_users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    if (roleNow.rows[0]?.key === "road_authority") {
      await client.query("ROLLBACK");
      return "authority";
    }

    const updated = await client.query(
      `UPDATE fleet_users
       SET company_id = $2,
           role_id = $3,
           full_name = $4,
           phone = $5,
           address = $6,
           language = $7,
           updated_at = now()
       WHERE id = $1 AND company_id IS NULL AND deleted_at IS NULL`,
      [userId, companyId, roleId, input.fullName, input.phone, input.address, input.language]
    );

    if (updated.rowCount !== 1) {
      await client.query("ROLLBACK");
      return "exists";
    }

    await client.query(
      `INSERT INTO subscriptions (company_id, plan, status, vehicle_limit)
       VALUES ($1, 'free', 'active', 3)`,
      [companyId]
    );

    await client.query("COMMIT");
    return "created";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFleet(userId: string, input: CompanyInput): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ company_id: string | null }>(
      `SELECT company_id FROM fleet_users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const companyId = current.rows[0]?.company_id;
    if (!companyId) {
      await client.query("ROLLBACK");
      return false;
    }

    const companyUpdate = await client.query(
      `UPDATE companies
       SET name = $2,
           legal_name = $3,
           gstin = $4,
           phone = $5,
           email = $6,
           address = $7,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        companyId,
        input.companyName,
        input.legalName,
        input.gstin,
        input.companyPhone,
        input.companyEmail,
        input.companyAddress,
      ]
    );
    if (companyUpdate.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `UPDATE fleet_users
       SET full_name = $2, phone = $3, address = $4, language = $5, updated_at = now()
       WHERE id = $1 AND company_id = $6 AND deleted_at IS NULL`,
      [userId, input.fullName, input.phone, input.address, input.language, companyId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
