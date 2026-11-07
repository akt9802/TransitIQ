import { randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { emailTrackingLink } from "@/lib/company/tracking-link";
import { metersBetween, pickupAwayMessage, STOP_RANGE_METERS, stopAwayMessage } from "@/lib/company/geo";
import { proofsForTrips } from "@/lib/company/proofs";
import { costsForTrips, emptyTripCost } from "@/lib/company/trip-cost";
import { assertTripPapers } from "@/lib/company/papers";
import type { CustomerRecord, TripInput, TripRecord, TripStopInput, TripStopRecord } from "@/lib/company/types";
import { LIVE_TRIP_STATUSES } from "@/lib/company/types";

const LIVE = LIVE_TRIP_STATUSES.map((status) => `'${status}'`).join(", ");

const NEXT: Record<string, string[]> = {
  created: ["canceled"],
  assigned: ["started", "canceled"],
  started: ["loading", "assigned", "canceled"],
  loading: ["in_transit", "canceled"],
  in_transit: ["unloading", "canceled"],
  unloading: ["completed", "canceled"],
  completed: ["closed"],
  closed: [],
  canceled: [],
};

type TripRow = {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  tracking_token: string | null;
  load_type: string | null;
  weight_kg: string | number | null;
  deadline_at: Date | string | null;
  notes: string | null;
  order_status: string | null;
  vehicle_id: string | null;
  registration_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  status: string;
  eta_at: Date | string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  closed_at: Date | string | null;
  empty_run: boolean;
  created_at: Date | string;
  stops: TripStopRecord[] | string | null;
};

function asInstant(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asNumber(value: string | number | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStops(value: TripRow["stops"]): TripStopRecord[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as TripStopRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toTrip(row: TripRow): TripRecord {
  const stops = readStops(row.stops);
  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    customerName: row.customer_name ?? "Customer",
    customerEmail: row.customer_email,
    trackingToken: row.tracking_token,
    loadType: row.load_type,
    weightKg: asNumber(row.weight_kg),
    deadlineAt: asInstant(row.deadline_at),
    notes: row.notes,
    orderStatus: row.order_status ?? "open",
    vehicleId: row.vehicle_id,
    vehicleRegistration: row.registration_number,
    driverId: row.driver_id,
    driverName: row.driver_name,
    status: row.status,
    etaAt: asInstant(row.eta_at),
    startedAt: asInstant(row.started_at),
    completedAt: asInstant(row.completed_at),
    closedAt: asInstant(row.closed_at),
    emptyRun: row.empty_run,
    createdAt: asInstant(row.created_at) ?? new Date(0).toISOString(),
    proofs: [],
    cost: emptyTripCost(row.status),
    stops: stops
      .map((stop) => ({
        id: stop.id,
        sequence: Number(stop.sequence),
        kind: stop.kind,
        address: stop.address,
        latitude: asNumber(stop.latitude),
        longitude: asNumber(stop.longitude),
        scheduledAt: asInstant(stop.scheduledAt),
        arrivedAt: asInstant(stop.arrivedAt),
        departedAt: asInstant(stop.departedAt),
      }))
      .sort((a, b) => a.sequence - b.sequence),
  };
}

export async function listCustomers(companyId: string): Promise<CustomerRecord[]> {
  const { rows } = await getPool().query<CustomerRecord>(
    `SELECT id, name, phone, email FROM customers
     WHERE company_id = $1 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [companyId]
  );
  return rows;
}

export async function listTrips(companyId: string, driverId?: string | null): Promise<TripRecord[]> {
  const { rows } = await getPool().query<TripRow>(
    `SELECT t.id, t.order_id, t.customer_id, c.name AS customer_name, c.email AS customer_email, t.tracking_token,
            o.load_type, o.weight_kg, o.deadline_at, o.notes, o.status AS order_status,
            t.vehicle_id, v.registration_number, t.driver_id, d.full_name AS driver_name,
            t.status, t.eta_at, t.started_at, t.completed_at, t.closed_at, t.empty_run, t.created_at,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', s.id,
                  'sequence', s.sequence,
                  'kind', s.kind,
                  'address', s.address,
                  'latitude', s.latitude,
                  'longitude', s.longitude,
                  'scheduledAt', s.scheduled_at,
                  'arrivedAt', s.arrived_at,
                  'departedAt', s.departed_at
                ) ORDER BY s.sequence
              ) FILTER (WHERE s.id IS NOT NULL),
              '[]'::jsonb
            ) AS stops
     FROM trips t
     LEFT JOIN orders o ON o.id = t.order_id AND o.deleted_at IS NULL
     LEFT JOIN customers c ON c.id = t.customer_id AND c.deleted_at IS NULL
     LEFT JOIN drivers d ON d.id = t.driver_id AND d.deleted_at IS NULL
     LEFT JOIN vehicles v ON v.id = t.vehicle_id AND v.deleted_at IS NULL
     LEFT JOIN trip_stops s ON s.trip_id = t.id
     WHERE t.company_id = $1 AND t.deleted_at IS NULL
       AND ($2::uuid IS NULL OR t.driver_id = $2)
     GROUP BY t.id, c.name, c.email, o.load_type, o.weight_kg, o.deadline_at, o.notes, o.status,
              v.registration_number, d.full_name
     ORDER BY t.created_at DESC`,
    [companyId, driverId ?? null]
  );
  const trips = rows.map(toTrip);
  const [proofs, costs] = await Promise.all([
    proofsForTrips(companyId, trips.map((trip) => trip.id)),
    costsForTrips(
      companyId,
      trips.map((trip) => ({ id: trip.id, status: trip.status, driverId: trip.driverId }))
    ),
  ]);
  for (const trip of trips) {
    trip.proofs = proofs.get(trip.id) ?? [];
    trip.cost = costs.get(trip.id) ?? emptyTripCost(trip.status);
  }
  return trips;
}

async function resolveCustomer(client: PoolClient, companyId: string, input: TripInput): Promise<string> {
  if (input.customerId) {
    const found = await client.query(
      `SELECT 1 FROM customers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [input.customerId, companyId]
    );
    if (!found.rowCount) throw new Error("Choose a customer in this fleet");
    await client.query(
      `UPDATE customers SET email = $3, updated_at = now() WHERE id = $1 AND company_id = $2`,
      [input.customerId, companyId, input.customerEmail]
    );
    return input.customerId;
  }
  const created = await client.query<{ id: string }>(
    `INSERT INTO customers (company_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id`,
    [companyId, input.customerName, input.customerPhone, input.customerEmail]
  );
  return created.rows[0].id;
}

async function assertAssignable(
  client: PoolClient,
  companyId: string,
  input: TripInput,
  excludeTripId: string | null
) {
  const driver = await client.query<{ status: string }>(
    `SELECT status
     FROM drivers
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
     FOR UPDATE`,
    [input.driverId, companyId]
  );
  const driverRow = driver.rows[0];
  if (!driverRow) throw new Error("Choose a driver in this fleet");
  if (driverRow.status === "on_leave") throw new Error("This driver is on leave");
  if (driverRow.status === "inactive") throw new Error("This driver is inactive");

  const vehicle = await client.query<{ status: string }>(
    `SELECT status FROM vehicles
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
     FOR UPDATE`,
    [input.vehicleId, companyId]
  );
  const vehicleRow = vehicle.rows[0];
  if (!vehicleRow) throw new Error("Choose a truck in this fleet");
  if (vehicleRow.status === "retired") throw new Error("This truck is retired");
  if (vehicleRow.status === "maintenance") throw new Error("This truck is under maintenance");
  await assertTripPapers(client, companyId, input.driverId, input.vehicleId);

  const start = input.stops[0]?.scheduledAt;
  const end = input.stops[input.stops.length - 1]?.scheduledAt;
  if (!start) throw new Error("Start time is required");
  if (!end) throw new Error("End time is required");
  const clash = await client.query<{
    driver_id: string | null;
    vehicle_id: string | null;
    window_start: Date | null;
    window_end: Date | null;
  }>(
    `SELECT t.driver_id, t.vehicle_id,
            COALESCE(first_stop.scheduled_at, t.started_at, t.created_at) AS window_start,
            last_stop.scheduled_at AS window_end
     FROM trips t
     JOIN trip_stops first_stop ON first_stop.trip_id = t.id
       AND first_stop.sequence = (SELECT MIN(sequence) FROM trip_stops WHERE trip_id = t.id)
     JOIN trip_stops last_stop ON last_stop.trip_id = t.id
       AND last_stop.sequence = (SELECT MAX(sequence) FROM trip_stops WHERE trip_id = t.id)
     WHERE t.company_id = $1 AND t.deleted_at IS NULL
       AND t.status IN ('assigned', 'started', 'loading', 'in_transit', 'unloading')
       AND ($2::uuid IS NULL OR t.id <> $2)
       AND (t.driver_id = $3 OR t.vehicle_id = $4)
       AND COALESCE(first_stop.scheduled_at, t.started_at, t.created_at) < $6::timestamptz
       AND COALESCE(last_stop.scheduled_at, 'infinity'::timestamptz) > $5::timestamptz
     LIMIT 1`,
    [companyId, excludeTripId, input.driverId, input.vehicleId, start, end]
  );
  const hit = clash.rows[0];
  if (hit) {
    const from = hit.window_start
      ? hit.window_start.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : "an earlier time";
    const until = hit.window_end
      ? hit.window_end.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : "that trip is finished";
    if (hit.driver_id === input.driverId) {
      throw new Error(`This driver is already booked from ${from} to ${until}`);
    }
    throw new Error(`This truck is already booked from ${from} to ${until}`);
  }
}

async function insertStops(client: PoolClient, companyId: string, tripId: string, stops: TripStopInput[]) {
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    await client.query(
      `INSERT INTO trip_stops (company_id, trip_id, sequence, kind, address, latitude, longitude, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [companyId, tripId, index + 1, stop.kind, stop.address, stop.latitude, stop.longitude, stop.scheduledAt]
    );
  }
}

async function withTrip<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createTrip(companyId: string, input: TripInput) {
  await withTrip(async (client) => {
    const customerId = await resolveCustomer(client, companyId, input);
    await assertAssignable(client, companyId, input, null);
    const order = await client.query<{ id: string }>(
      `INSERT INTO orders (company_id, customer_id, load_type, weight_kg, deadline_at, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'assigned')
       RETURNING id`,
      [companyId, customerId, input.loadType, input.weightKg, input.deadlineAt, input.notes]
    );
    const orderId = order.rows[0].id;
    const trip = await client.query<{ id: string }>(
      `INSERT INTO trips (
         company_id, order_id, customer_id, vehicle_id, driver_id, status, eta_at, empty_run, tracking_token
       ) VALUES ($1, $2, $3, $4, $5, 'assigned', $6, $7, $8)
       RETURNING id`,
      [companyId, orderId, customerId, input.vehicleId, input.driverId, input.etaAt, input.emptyRun, randomBytes(24).toString("base64url")]
    );
    await insertStops(client, companyId, trip.rows[0].id, input.stops);
  });
}

export async function updateTrip(companyId: string, tripId: string, input: TripInput) {
  await withTrip(async (client) => {
    const current = await client.query<{ status: string; order_id: string | null; email: string | null }>(
      `SELECT t.status, t.order_id, c.email
       FROM trips t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.id = $1 AND t.company_id = $2 AND t.deleted_at IS NULL
       FOR UPDATE OF t`,
      [tripId, companyId]
    );
    const trip = current.rows[0];
    if (!trip) throw new Error("That trip was not found");
    if (trip.status !== "created" && trip.status !== "assigned") {
      throw new Error("A trip that has started cannot be edited");
    }
    const customerId = await resolveCustomer(client, companyId, input);
    await assertAssignable(client, companyId, input, tripId);
    if (trip.order_id) {
      await client.query(
        `UPDATE orders
         SET customer_id = $3, load_type = $4, weight_kg = $5, deadline_at = $6, notes = $7,
             status = 'assigned', updated_at = now()
         WHERE id = $1 AND company_id = $2`,
        [trip.order_id, companyId, customerId, input.loadType, input.weightKg, input.deadlineAt, input.notes]
      );
    }
    await client.query(
      `UPDATE trips
       SET customer_id = $3, vehicle_id = $4, driver_id = $5, eta_at = $6, empty_run = $7,
           status = 'assigned', updated_at = now()
       WHERE id = $1 AND company_id = $2`,
      [tripId, companyId, customerId, input.vehicleId, input.driverId, input.etaAt, input.emptyRun]
    );
    await client.query(`DELETE FROM trip_stops WHERE trip_id = $1 AND company_id = $2`, [tripId, companyId]);
    await insertStops(client, companyId, tripId, input.stops);
  });
}

async function releaseVehicle(client: PoolClient, companyId: string, vehicleId: string | null) {
  if (!vehicleId) return;
  const live = await client.query(
    `SELECT 1 FROM trips
     WHERE company_id = $1 AND vehicle_id = $2 AND deleted_at IS NULL
       AND status IN (${LIVE})
     LIMIT 1`,
    [companyId, vehicleId]
  );
  if ((live.rowCount ?? 0) > 0) return;
  await client.query(
    `UPDATE vehicles SET status = 'active', updated_at = now()
     WHERE id = $1 AND company_id = $2 AND status = 'on_trip'`,
    [vehicleId, companyId]
  );
}

type Here = { latitude: number; longitude: number };

function assertNear(here: Here | null, stop: { latitude: number | null; longitude: number | null }, message: string) {
  if (!here) throw new Error("Location is required");
  if (stop.latitude == null || stop.longitude == null) throw new Error("This stop location is not valid");
  const meters = metersBetween(
    { lat: here.latitude, lng: here.longitude },
    { lat: Number(stop.latitude), lng: Number(stop.longitude) }
  );
  if (meters > STOP_RANGE_METERS) throw new Error(message);
}

export async function changeTripStatus(
  companyId: string,
  tripId: string,
  status: string,
  options?: { here?: Here | null; enforcePlace?: boolean; origin?: string }
) {
  let justStarted = false;
  await withTrip(async (client) => {
    const current = await client.query<{
      status: string;
      order_id: string | null;
      driver_id: string | null;
      vehicle_id: string | null;
      started_at: Date | null;
    }>(
      `SELECT status, order_id, driver_id, vehicle_id, started_at
       FROM trips
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [tripId, companyId]
    );
    const trip = current.rows[0];
    if (!trip) throw new Error("That trip was not found");
    if (!(NEXT[trip.status] ?? []).includes(status)) {
      throw new Error("This trip cannot move to that status");
    }

    if (status === "started") {
      if (!trip.driver_id || !trip.vehicle_id) throw new Error("Choose a driver and a truck first");
      const stops = await client.query<{ kind: string; address: string | null; scheduled_at: Date | null }>(
        `SELECT kind, address, scheduled_at FROM trip_stops WHERE trip_id = $1 ORDER BY sequence ASC`,
        [tripId]
      );
      await assertAssignable(
        client,
        companyId,
        {
          customerId: null,
          customerName: null,
          customerPhone: null,
          customerEmail: "",
          loadType: null,
          weightKg: null,
          deadlineAt: null,
          notes: null,
          driverId: trip.driver_id,
          vehicleId: trip.vehicle_id,
          emptyRun: false,
          etaAt: null,
          stops: stops.rows.map((stop) => ({
            kind: stop.kind,
            address: stop.address ?? "",
            latitude: null,
            longitude: null,
            scheduledAt: stop.scheduled_at ? stop.scheduled_at.toISOString() : null,
          })),
        },
        tripId
      );
      const busyDriver = await client.query(
        `SELECT 1 FROM trips
         WHERE company_id = $1 AND driver_id = $2 AND id <> $3 AND deleted_at IS NULL
           AND status IN (${LIVE})
         LIMIT 1`,
        [companyId, trip.driver_id, tripId]
      );
      if ((busyDriver.rowCount ?? 0) > 0) throw new Error("This driver already has a live trip");
      const busyTruck = await client.query(
        `SELECT 1 FROM trips
         WHERE company_id = $1 AND vehicle_id = $2 AND id <> $3 AND deleted_at IS NULL
           AND status IN (${LIVE})
         LIMIT 1`,
        [companyId, trip.vehicle_id, tripId]
      );
      if ((busyTruck.rowCount ?? 0) > 0) throw new Error("This truck already has a live trip");
      await client.query(
        `UPDATE trips SET status = 'started', started_at = COALESCE(started_at, now()), updated_at = now()
         WHERE id = $1`,
        [tripId]
      );
      await client.query(
        `UPDATE vehicles SET status = 'on_trip', updated_at = now()
         WHERE id = $1 AND company_id = $2 AND status NOT IN ('retired', 'maintenance')`,
        [trip.vehicle_id, companyId]
      );
      justStarted = true;
      return;
    }

    if (status === "assigned") {
      await client.query(
        `UPDATE trips SET status = 'assigned', started_at = NULL, updated_at = now() WHERE id = $1`,
        [tripId]
      );
      await client.query(
        `UPDATE trip_stops SET arrived_at = NULL, departed_at = NULL, updated_at = now() WHERE trip_id = $1`,
        [tripId]
      );
      await releaseVehicle(client, companyId, trip.vehicle_id);
      return;
    }

    if (status === "loading" || status === "unloading") {
      if (options?.enforcePlace) {
        const stops = await client.query<{
          latitude: number | null;
          longitude: number | null;
          address: string | null;
        }>(
          `SELECT latitude, longitude, address FROM trip_stops WHERE trip_id = $1 ORDER BY sequence ASC`,
          [tripId]
        );
        const stop = status === "loading" ? stops.rows[0] : stops.rows[stops.rows.length - 1];
        if (!stop) throw new Error("A start and an end are required");
        assertNear(
          options.here ?? null,
          stop,
          status === "loading" ? pickupAwayMessage() : stopAwayMessage("the end stop")
        );
      }
      await client.query(`UPDATE trips SET status = $2, updated_at = now() WHERE id = $1`, [tripId, status]);
      if (status === "loading") {
        await client.query(
          `UPDATE trip_stops SET arrived_at = COALESCE(arrived_at, now()), updated_at = now()
           WHERE trip_id = $1 AND sequence = (SELECT MIN(sequence) FROM trip_stops WHERE trip_id = $1)`,
          [tripId]
        );
      } else {
        await client.query(
          `UPDATE trip_stops SET arrived_at = COALESCE(arrived_at, now()), updated_at = now()
           WHERE trip_id = $1 AND sequence = (SELECT MAX(sequence) FROM trip_stops WHERE trip_id = $1)`,
          [tripId]
        );
      }
      return;
    }

    if (status === "in_transit") {
      const pickup = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM trip_proofs WHERE trip_id = $1 AND kind = 'pickup'`,
        [tripId]
      );
      if ((pickup.rows[0]?.n ?? 0) < 2) throw new Error("2 pickup photos are required");
      await client.query(`UPDATE trips SET status = 'in_transit', updated_at = now() WHERE id = $1`, [tripId]);
      await client.query(
        `UPDATE trip_stops SET departed_at = COALESCE(departed_at, now()), updated_at = now()
         WHERE trip_id = $1 AND sequence = (SELECT MIN(sequence) FROM trip_stops WHERE trip_id = $1)`,
        [tripId]
      );
      return;
    }

    if (status === "completed") {
      const delivery = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM trip_proofs WHERE trip_id = $1 AND kind = 'delivery'`,
        [tripId]
      );
      if ((delivery.rows[0]?.n ?? 0) < 2) throw new Error("2 delivery photos are required");
      await client.query(
        `UPDATE trips SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
         WHERE id = $1`,
        [tripId]
      );
      await client.query(
        `UPDATE trip_stops SET departed_at = COALESCE(departed_at, now()), updated_at = now()
         WHERE trip_id = $1 AND sequence = (SELECT MAX(sequence) FROM trip_stops WHERE trip_id = $1)`,
        [tripId]
      );
      if (trip.order_id) {
        await client.query(
          `UPDATE orders SET status = 'completed', updated_at = now() WHERE id = $1 AND company_id = $2`,
          [trip.order_id, companyId]
        );
      }
      await releaseVehicle(client, companyId, trip.vehicle_id);
      return;
    }

    if (status === "closed") {
      await client.query(
        `UPDATE trips SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now()
         WHERE id = $1`,
        [tripId]
      );
      return;
    }

    if (status === "canceled") {
      await client.query(
        `UPDATE trips SET status = 'canceled', updated_at = now() WHERE id = $1`,
        [tripId]
      );
      if (trip.order_id) {
        const orderStatus = trip.started_at ? "canceled" : "open";
        await client.query(
          `UPDATE orders SET status = $3, updated_at = now() WHERE id = $1 AND company_id = $2`,
          [trip.order_id, companyId, orderStatus]
        );
      }
      await releaseVehicle(client, companyId, trip.vehicle_id);
      return;
    }

    await client.query(`UPDATE trips SET status = $2, updated_at = now() WHERE id = $1`, [tripId, status]);
  });
  if (!justStarted || !options?.origin) return { emailed: false, emailError: null };
  try {
    return await emailTrackingLink({ companyId, tripId, origin: options.origin });
  } catch (error) {
    return {
      emailed: false,
      emailError: error instanceof Error ? error.message : "The tracking email could not be sent",
    };
  }
}

export async function markStopReached(companyId: string, tripId: string, here: Here) {
  await withTrip(async (client) => {
    const current = await client.query<{ status: string }>(
      `SELECT status FROM trips WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [tripId, companyId]
    );
    if (current.rows[0]?.status !== "in_transit") throw new Error("You cannot mark a stop until you are on the road");
    const stops = await client.query<{
      id: string;
      arrived_at: Date | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT id, arrived_at, latitude, longitude FROM trip_stops WHERE trip_id = $1 ORDER BY sequence ASC`,
      [tripId]
    );
    const next = stops.rows.find((stop) => !stop.arrived_at);
    const last = stops.rows[stops.rows.length - 1];
    if (!next || !last) throw new Error("A start and an end are required");
    if (next.id === last.id) throw new Error("You cannot mark the last stop this way");
    assertNear(here, next, stopAwayMessage("this stop"));
    await client.query(
      `UPDATE trip_stops SET arrived_at = now(), updated_at = now() WHERE id = $1`,
      [next.id]
    );
  });
}
