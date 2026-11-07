import { ensureFleetSchema } from "@/lib/company/fleet-schema";
import { getPool } from "@/lib/db";

/** Company, people, and access tables. Safe to call more than once. */
let companyReady = false;

export async function ensureCompanySchema(): Promise<void> {
  if (companyReady) return;

  const pool = getPool();

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL DEFAULT 'fleet' CHECK (kind IN ('fleet', 'authority', 'contractor')),
      name text NOT NULL,
      legal_name text,
      gstin text,
      phone text,
      email text,
      address text,
      logo_key text,
      invoice_template text,
      plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
      vehicle_limit integer NOT NULL DEFAULT 3,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      name text NOT NULL,
      address text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      name text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      description text
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id uuid NOT NULL REFERENCES roles(id),
      permission_id uuid NOT NULL REFERENCES permissions(id),
      PRIMARY KEY (role_id, permission_id)
    );
  `);

  await pool.query(`
    ALTER TABLE fleet_users
      ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id),
      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id),
      ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id),
      ADD COLUMN IF NOT EXISTS full_name text,
      ADD COLUMN IF NOT EXISTS phone text,
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS large_text boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS high_contrast boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fleet_users_language_check'
      ) THEN
        ALTER TABLE fleet_users
          ADD CONSTRAINT fleet_users_language_check CHECK (language IN ('en', 'hi'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fleet_users_company ON fleet_users(company_id);
    CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);

    CREATE TABLE IF NOT EXISTS vehicles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      branch_id uuid REFERENCES branches(id),
      vendor_id uuid,
      registration_number text NOT NULL,
      make text,
      model text,
      year integer,
      chassis_number text,
      engine_number text,
      truck_type text NOT NULL CHECK (truck_type IN ('open', 'closed', 'trailer', 'tanker', 'container')),
      load_capacity_kg numeric(12,3),
      axle_count integer,
      length_m numeric(8,3),
      width_m numeric(8,3),
      height_m numeric(8,3),
      ownership text NOT NULL DEFAULT 'owned' CHECK (ownership IN ('owned', 'leased', 'attached')),
      contract_start date,
      contract_end date,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_trip', 'idle', 'maintenance', 'retired')),
      odometer_km numeric(12,3),
      tank_capacity_l numeric(8,3),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE UNIQUE INDEX IF NOT EXISTS vehicles_company_registration
      ON vehicles (company_id, lower(registration_number))
      WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
  `);

  await pool.query(`
    INSERT INTO roles (key, name) VALUES
      ('super_admin', 'Super Admin'),
      ('owner', 'Owner'),
      ('fleet_manager', 'Fleet Manager'),
      ('dispatcher', 'Dispatcher'),
      ('accountant', 'Accountant'),
      ('driver', 'Driver'),
      ('mechanic', 'Mechanic'),
      ('road_authority', 'Road Authority'),
      ('contractor', 'Contractor'),
      ('customer', 'Customer')
    ON CONFLICT (key) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO permissions (key, description) VALUES
      ('company.read', 'View the company'),
      ('company.write', 'Edit the company and the owner profile'),
      ('people.read', 'View people in the company'),
      ('people.write', 'Add or change people'),
      ('vehicles.read', 'View trucks'),
      ('vehicles.write', 'Add or change trucks')
    ON CONFLICT (key) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.key = 'owner' AND p.key IN (
        'company.read', 'company.write', 'people.read', 'people.write', 'vehicles.read', 'vehicles.write'
      ))
      OR (r.key = 'fleet_manager' AND p.key IN (
        'company.read', 'people.read', 'people.write', 'vehicles.read', 'vehicles.write'
      ))
      OR (r.key = 'dispatcher' AND p.key IN ('company.read', 'people.read', 'vehicles.read'))
      OR (r.key = 'accountant' AND p.key IN ('company.read', 'people.read', 'vehicles.read'))
    )
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      plan text NOT NULL CHECK (plan IN ('free', 'pro', 'authority')),
      status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
      vehicle_limit integer NOT NULL,
      provider text,
      provider_ref text,
      current_period_end timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      name text NOT NULL,
      key_hash text NOT NULL UNIQUE,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES fleet_users(id),
      kind text NOT NULL CHECK (kind IN ('expiry', 'delay', 'hazard', 'repair', 'payment')),
      channel text NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'in_app')),
      enabled boolean NOT NULL DEFAULT true,
      UNIQUE (user_id, kind, channel)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);
  `);

  await pool.query(`
    INSERT INTO subscriptions (company_id, plan, status, vehicle_limit)
    SELECT c.id, c.plan, 'active', c.vehicle_limit
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM subscriptions s WHERE s.company_id = c.id AND s.status <> 'canceled'
    )
  `);

  await ensureFleetSchema();

  await pool.query(`
    INSERT INTO permissions (key, description) VALUES
      ('branches.read', 'View branches'),
      ('branches.write', 'Add or change branches'),
      ('drivers.read', 'View drivers'),
      ('drivers.write', 'Add or change drivers'),
      ('vendors.read', 'View attached-truck owners'),
      ('vendors.write', 'Add or change attached-truck owners'),
      ('devices.read', 'View trackers'),
      ('devices.write', 'Add or change trackers')
    ON CONFLICT (key) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.key = 'owner' AND p.key IN (
        'branches.read', 'branches.write', 'drivers.read', 'drivers.write',
        'vendors.read', 'vendors.write', 'devices.read', 'devices.write'
      ))
      OR (r.key = 'fleet_manager' AND p.key IN (
        'branches.read', 'branches.write', 'drivers.read', 'drivers.write',
        'vendors.read', 'vendors.write', 'devices.read', 'devices.write'
      ))
      OR (r.key = 'dispatcher' AND p.key IN (
        'branches.read', 'drivers.read', 'vendors.read', 'devices.read'
      ))
      OR (r.key = 'accountant' AND p.key IN (
        'branches.read', 'drivers.read', 'vendors.read', 'devices.read'
      ))
    )
    ON CONFLICT DO NOTHING
  `);

  companyReady = true;
}
