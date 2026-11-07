import { randomBytes } from "crypto";
import { getPool } from "@/lib/db";

let operationsReady = false;

/** Customers, orders, trips, and stops. Safe to call more than once. */
export async function ensureOperationsSchema(): Promise<void> {
  if (operationsReady) return;
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      name text NOT NULL,
      phone text,
      email text,
      gstin text,
      address text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      customer_id uuid NOT NULL REFERENCES customers(id),
      load_type text,
      weight_kg numeric(12,3),
      deadline_at timestamptz,
      notes text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'completed', 'canceled')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS trips (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      order_id uuid REFERENCES orders(id),
      customer_id uuid REFERENCES customers(id),
      vehicle_id uuid REFERENCES vehicles(id),
      driver_id uuid REFERENCES drivers(id),
      status text NOT NULL DEFAULT 'created' CHECK (status IN (
        'created', 'assigned', 'started', 'loading', 'in_transit', 'unloading', 'completed', 'closed', 'canceled'
      )),
      route_reason text,
      eta_at timestamptz,
      started_at timestamptz,
      completed_at timestamptz,
      closed_at timestamptz,
      empty_run boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS trip_stops (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      trip_id uuid NOT NULL REFERENCES trips(id),
      sequence integer NOT NULL,
      kind text NOT NULL CHECK (kind IN ('pickup', 'drop', 'return')),
      address text,
      scheduled_at timestamptz,
      arrived_at timestamptz,
      departed_at timestamptz,
      detention_minutes integer,
      detention_charge numeric(12,2),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (trip_id, sequence)
    );

    CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
    CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
    CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company_id);
    CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trip_stops_trip ON trip_stops(trip_id);

    ALTER TABLE trip_stops
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision;
    CREATE UNIQUE INDEX IF NOT EXISTS trips_one_live_driver
      ON trips (driver_id)
      WHERE deleted_at IS NULL AND status IN ('started', 'loading', 'in_transit', 'unloading');
    CREATE UNIQUE INDEX IF NOT EXISTS trips_one_live_vehicle
      ON trips (vehicle_id)
      WHERE deleted_at IS NULL AND status IN ('started', 'loading', 'in_transit', 'unloading');

    CREATE TABLE IF NOT EXISTS location_points (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid REFERENCES vehicles(id),
      trip_id uuid REFERENCES trips(id),
      driver_id uuid REFERENCES drivers(id),
      recorded_at timestamptz NOT NULL DEFAULT now(),
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      speed_kmh double precision,
      moving boolean NOT NULL DEFAULT false,
      source text NOT NULL DEFAULT 'phone' CHECK (source IN ('gps', 'phone'))
    );
    CREATE INDEX IF NOT EXISTS idx_location_points_trip ON location_points(trip_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_location_points_driver ON location_points(driver_id, recorded_at);
  `);

  await pool.query(`
    ALTER TABLE location_points
      ADD COLUMN IF NOT EXISTS speed_kmh double precision,
      ADD COLUMN IF NOT EXISTS moving boolean NOT NULL DEFAULT false
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_proofs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      trip_id uuid NOT NULL REFERENCES trips(id),
      trip_stop_id uuid NOT NULL REFERENCES trip_stops(id),
      driver_id uuid REFERENCES drivers(id),
      kind text NOT NULL CHECK (kind IN ('pickup', 'delivery')),
      image bytea NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      taken_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_trip_proofs_trip ON trip_proofs(trip_id, kind);

    CREATE TABLE IF NOT EXISTS fuel_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id),
      driver_id uuid REFERENCES drivers(id),
      trip_id uuid REFERENCES trips(id),
      timing text NOT NULL DEFAULT 'no_trip' CHECK (timing IN ('before_trip', 'on_trip', 'after_trip', 'no_trip')),
      filled_at timestamptz NOT NULL DEFAULT now(),
      litres numeric(12,3) NOT NULL,
      amount numeric(12,2) NOT NULL,
      price_per_litre numeric(8,2) NOT NULL,
      details text,
      image bytea NOT NULL,
      latitude double precision,
      longitude double precision,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS idx_fuel_entries_company ON fuel_entries(company_id, filled_at DESC);

    CREATE TABLE IF NOT EXISTS extra_costs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id),
      driver_id uuid REFERENCES drivers(id),
      trip_id uuid REFERENCES trips(id),
      timing text NOT NULL CHECK (timing IN ('before_trip', 'on_trip', 'after_trip', 'no_trip')),
      kind text NOT NULL CHECK (kind IN ('puncture', 'engine', 'other')),
      amount numeric(12,2) NOT NULL,
      details text NOT NULL,
      image bytea NOT NULL,
      latitude double precision,
      longitude double precision,
      spent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS idx_extra_costs_company ON extra_costs(company_id, spent_at DESC);
  `);

  await pool.query(`
    ALTER TABLE trip_proofs ADD COLUMN IF NOT EXISTS image bytea;
    ALTER TABLE fuel_entries ADD COLUMN IF NOT EXISTS image bytea;
    ALTER TABLE fuel_entries ADD COLUMN IF NOT EXISTS timing text;
  `);

  await pool.query(`
    UPDATE fuel_entries
    SET timing = CASE WHEN trip_id IS NULL THEN 'no_trip' ELSE 'on_trip' END
    WHERE timing IS NULL
  `);

  await pool.query(`ALTER TABLE fuel_entries ALTER COLUMN timing SET NOT NULL`);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fuel_entries_timing_check'
      ) THEN
        ALTER TABLE fuel_entries
          ADD CONSTRAINT fuel_entries_timing_check
          CHECK (timing IS NULL OR timing IN ('before_trip', 'on_trip', 'after_trip', 'no_trip'));
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trip_proofs' AND column_name = 'file_key'
      ) THEN
        ALTER TABLE trip_proofs ALTER COLUMN file_key DROP NOT NULL;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'fuel_entries' AND column_name = 'receipt_key'
      ) THEN
        ALTER TABLE fuel_entries ALTER COLUMN receipt_key DROP NOT NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE fleet_users
      ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id)
  `);

  await pool.query(`
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS tracking_token text;
    CREATE UNIQUE INDEX IF NOT EXISTS trips_tracking_token ON trips (tracking_token) WHERE tracking_token IS NOT NULL;
  `);

  const missingTokens = await pool.query<{ id: string }>(
    `SELECT id FROM trips WHERE tracking_token IS NULL`
  );
  for (const row of missingTokens.rows) {
    await pool.query(
      `UPDATE trips SET tracking_token = $2 WHERE id = $1 AND tracking_token IS NULL`,
      [row.id, randomBytes(24).toString("base64url")]
    );
  }

  await pool.query(`
    INSERT INTO permissions (key, description) VALUES
      ('trips.read', 'View trips'),
      ('trips.write', 'Assign and update trips')
    ON CONFLICT (key) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.key IN ('owner', 'fleet_manager', 'dispatcher') AND p.key IN ('trips.read', 'trips.write'))
      OR (r.key IN ('accountant', 'driver') AND p.key = 'trips.read')
    )
    ON CONFLICT DO NOTHING
  `);

  operationsReady = true;
}
