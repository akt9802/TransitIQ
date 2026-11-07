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
  `);

  await pool.query(`
    ALTER TABLE fleet_users
      ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id)
  `);

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
