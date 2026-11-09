import { getPool } from "@/lib/db";

let fleetReady = false;

/** Trucks, drivers, vendors, papers, and trackers. Safe to call more than once. */
export async function ensureFleetSchema(): Promise<void> {
  if (fleetReady) return;
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      name text NOT NULL,
      phone text,
      gstin text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      branch_id uuid REFERENCES branches(id),
      full_name text NOT NULL,
      phone text NOT NULL,
      address text,
      photo_key text,
      emergency_name text,
      emergency_phone text,
      license_number text,
      license_class text,
      license_expires_on date,
      license_endorsements text,
      pay_type text NOT NULL DEFAULT 'per_trip' CHECK (pay_type IN ('per_trip', 'per_km', 'salary')),
      pay_rate numeric(12,2),
      performance_score numeric(5,2),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS vehicle_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id),
      kind text NOT NULL CHECK (kind IN ('rc', 'insurance', 'permit', 'fitness', 'pollution', 'road_tax')),
      document_number text,
      file_key text,
      issued_on date,
      expires_on date,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS driver_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      kind text NOT NULL CHECK (kind IN ('license', 'other')),
      document_number text,
      file_key text,
      expires_on date,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid REFERENCES vehicles(id),
      driver_id uuid REFERENCES drivers(id),
      kind text NOT NULL CHECK (kind IN ('gps', 'phone')),
      external_id text NOT NULL,
      last_seen_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS driver_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      vehicle_id uuid REFERENCES vehicles(id),
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS driver_attendance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      day date NOT NULL,
      kind text NOT NULL CHECK (kind IN ('present', 'absent', 'leave')),
      note text,
      UNIQUE (driver_id, day)
    );

    CREATE TABLE IF NOT EXISTS hos_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      trip_id uuid,
      kind text NOT NULL CHECK (kind IN ('driving', 'rest')),
      started_at timestamptz NOT NULL,
      ended_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS driver_point_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      points integer NOT NULL,
      reason text NOT NULL,
      source_type text CHECK (source_type IS NULL OR source_type IN ('incident_report', 'trip')),
      source_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
    CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_driver_documents_driver ON driver_documents(driver_id);
    CREATE UNIQUE INDEX IF NOT EXISTS devices_external_id
      ON devices (external_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_devices_company ON devices(company_id);
    CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver ON driver_shifts(driver_id);
    CREATE INDEX IF NOT EXISTS idx_driver_attendance_driver ON driver_attendance(driver_id);
  `);

  await pool.query(`
    ALTER TABLE fleet_users
      ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS fleet_users_driver
      ON fleet_users (driver_id)
      WHERE driver_id IS NOT NULL AND deleted_at IS NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vendor_id_fkey'
      ) THEN
        ALTER TABLE vehicles
          ADD CONSTRAINT vehicles_vendor_id_fkey
          FOREIGN KEY (vendor_id) REFERENCES vendors(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE hos_logs DROP CONSTRAINT IF EXISTS hos_logs_kind_check;
    ALTER TABLE hos_logs
      ADD CONSTRAINT hos_logs_kind_check CHECK (kind IN ('driving', 'rest', 'sleep'));
  `);

  await pool.query(`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tracked_km numeric(12,3) NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id),
      name text NOT NULL,
      every_days integer,
      every_km numeric(12,3),
      next_due_on date,
      next_due_km numeric(12,3),
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CHECK (every_days IS NULL OR every_days > 0),
      CHECK (every_km IS NULL OR every_km > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_service_schedules_vehicle ON service_schedules(vehicle_id);
    ALTER TABLE service_schedules ADD COLUMN IF NOT EXISTS skip_trip_id uuid;

    CREATE TABLE IF NOT EXISTS potholes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_potholes_company ON potholes(company_id, latitude);

    CREATE TABLE IF NOT EXISTS pothole_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      pothole_id uuid NOT NULL REFERENCES potholes(id),
      driver_id uuid NOT NULL REFERENCES drivers(id),
      image bytea NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      points integer NOT NULL CHECK (points IN (12, 3)),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (pothole_id, driver_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pothole_reports_driver ON pothole_reports(driver_id, created_at DESC);

    ALTER TABLE potholes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
    ALTER TABLE potholes DROP CONSTRAINT IF EXISTS potholes_status_check;
    ALTER TABLE potholes ADD CONSTRAINT potholes_status_check CHECK (status IN ('pending', 'open', 'fixed', 'rejected'));
    ALTER TABLE potholes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'pothole';
    ALTER TABLE potholes DROP CONSTRAINT IF EXISTS potholes_kind_check;
    ALTER TABLE potholes ADD CONSTRAINT potholes_kind_check CHECK (kind IN ('pothole', 'water', 'accident', 'other'));
    ALTER TABLE potholes ADD COLUMN IF NOT EXISTS team_sent_at timestamptz;

    ALTER TABLE pothole_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
    ALTER TABLE pothole_reports ADD COLUMN IF NOT EXISTS awarded_at timestamptz;
    ALTER TABLE pothole_reports DROP CONSTRAINT IF EXISTS pothole_reports_points_check;
    ALTER TABLE pothole_reports ADD CONSTRAINT pothole_reports_points_check CHECK (points IN (0, 3, 12));
    ALTER TABLE pothole_reports DROP CONSTRAINT IF EXISTS pothole_reports_status_check;
    ALTER TABLE pothole_reports ADD CONSTRAINT pothole_reports_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
    UPDATE pothole_reports SET awarded_at = created_at WHERE awarded_at IS NULL AND points > 0;

    INSERT INTO permissions (key, description) VALUES
      ('roads.read', 'See potholes reported on the road')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON r.key = 'road_authority' AND p.key = 'roads.read'
    ON CONFLICT DO NOTHING;

    CREATE TABLE IF NOT EXISTS service_done (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      schedule_id uuid NOT NULL REFERENCES service_schedules(id),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id),
      name text NOT NULL,
      done_on date NOT NULL,
      odometer_km numeric(12,3),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS paper_reminder_sends (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      subject_key text NOT NULL,
      expires_on date NOT NULL,
      slot text NOT NULL CHECK (slot IN ('d30', 'd15', 'd7', 'morning', 'afternoon', 'evening', 'km1000', 'km500', 'km200')),
      sent_on date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (subject_key, expires_on, slot, sent_on)
    );
    ALTER TABLE paper_reminder_sends DROP CONSTRAINT IF EXISTS paper_reminder_sends_slot_check;
    ALTER TABLE paper_reminder_sends ADD CONSTRAINT paper_reminder_sends_slot_check
      CHECK (slot IN ('d30', 'd15', 'd7', 'morning', 'afternoon', 'evening', 'km1000', 'km500', 'km200'));
  `);

  fleetReady = true;
}
