"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AdminLiveTrips from "@/components/dashboard/AdminLiveTrips";
import { Modal } from "@/components/Modal";
import { Actions, Alert, Field, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { ProofStrip } from "@/components/dashboard/ProofPhotos";
import DriverRoute from "@/components/maps/DriverRoute";
import {
  metersBetween,
  pickupAwayMessage,
  placeTitle,
  STOP_RANGE_METERS,
  stopAwayMessage,
} from "@/lib/company/geo";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import { PlaceSearch, TripMap } from "@/components/maps/TripPlaces";
import { fieldClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import {
  LIVE_TRIP_STATUSES,
  TRIP_STATUSES,
  type CustomerRecord,
  type DriverRecord,
  type TripRecord,
  type VehicleRecord,
} from "@/lib/company/types";

type StopDraft = { kind: string; address: string; latitude: number | null; longitude: number | null; scheduledAt: string };

type Draft = {
  id: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  loadType: string;
  weightKg: string;
  deadlineAt: string;
  notes: string;
  driverId: string;
  vehicleId: string;
  emptyRun: boolean;
  etaAt: string;
  fromCopy: boolean;
  stops: StopDraft[];
};

const LIVE = new Set<string>(LIVE_TRIP_STATUSES);

const NEXT_ACTION: Record<string, { status: string; label: string }> = {
  assigned: { status: "started", label: "Start trip" },
  started: { status: "loading", label: "Start loading" },
  loading: { status: "in_transit", label: "On the road" },
  in_transit: { status: "unloading", label: "Start unloading" },
  unloading: { status: "completed", label: "Complete trip" },
  completed: { status: "closed", label: "Close trip" },
};

function blankStops(): StopDraft[] {
  return [
    { kind: "pickup", address: "", latitude: null, longitude: null, scheduledAt: "" },
    { kind: "drop", address: "", latitude: null, longitude: null, scheduledAt: "" },
  ];
}

function blank(): Draft {
  return {
    id: null,
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    loadType: "",
    weightKg: "",
    deadlineAt: "",
    notes: "",
    driverId: "",
    vehicleId: "",
    emptyRun: false,
    etaAt: "",
    fromCopy: false,
    stops: blankStops(),
  };
}

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function when(iso: string | null): string {
  if (!iso) return "Time not set";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string): string {
  return TRIP_STATUSES.find((item) => item.key === status)?.label ?? status;
}

function placeParts(address: string | null): { title: string; detail: string | null } {
  const trimmed = address?.trim();
  if (!trimmed) return { title: "Place not set", detail: null };
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return { title: trimmed, detail: null };
  return { title: parts.slice(0, 2).join(", "), detail: parts.slice(2).join(", ") };
}

function formatKm(meters: number): string {
  const km = meters / 1000;
  const rounded = km >= 100 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded.toLocaleString("en-IN")} km`;
}

function useDrivingLegs(stops: TripRecord["stops"]): number[] | null {
  const key = stops.map((stop) => `${stop.latitude ?? ""},${stop.longitude ?? ""}`).join("|");
  const [legs, setLegs] = useState<number[] | null>(null);

  useEffect(() => {
    if (stops.length < 2 || stops.some((stop) => stop.latitude == null || stop.longitude == null)) return;
    const points = stops;
    let cancelled = false;
    loadGoogleMaps()
      .then(async () => {
        const routesLibrary = (await google.maps.importLibrary("routes")) as google.maps.RoutesLibrary;
        const { routes } = await routesLibrary.Route.computeRoutes({
          origin: { lat: points[0].latitude as number, lng: points[0].longitude as number },
          destination: {
            lat: points[points.length - 1].latitude as number,
            lng: points[points.length - 1].longitude as number,
          },
          intermediates: points.slice(1, -1).map((stop) => ({
            lat: stop.latitude as number,
            lng: stop.longitude as number,
          })),
          travelMode: "DRIVING",
          fields: ["distanceMeters", "legs"],
        } as never);
        const meters = routes?.[0]?.legs?.map((leg) => leg.distanceMeters ?? 0) ?? [];
        if (!cancelled && meters.length > 0) setLegs(meters);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, stops]);

  return legs;
}

function stopLabel(index: number, kind: string, total: number): string {
  if (index === 0) return "Start";
  if (index === total - 1) return kind === "return" ? "Return" : "End";
  return kind === "return" ? "Return" : "Drop";
}

const BUSY = new Set(["assigned", "started", "loading", "in_transit", "unloading"]);

function draftWindow(stops: StopDraft[]): { start: number; end: number } | null {
  const start = new Date(stops[0]?.scheduledAt ?? "").getTime();
  const end = new Date(stops[stops.length - 1]?.scheduledAt ?? "").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function tripWindow(trip: TripRecord): { start: number; end: number } | null {
  if (!BUSY.has(trip.status)) return null;
  const start = new Date(trip.stops[0]?.scheduledAt ?? trip.startedAt ?? trip.createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const endAt = trip.stops[trip.stops.length - 1]?.scheduledAt;
  const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  return { start, end };
}

function overlaps(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && left.end > right.start;
}

function bookedIds(
  trips: TripRecord[],
  exceptId: string | null,
  window: { start: number; end: number },
  key: "driverId" | "vehicleId"
): Set<string> {
  const ids = new Set<string>();
  for (const trip of trips) {
    if (trip.id === exceptId) continue;
    const slot = tripWindow(trip);
    const id = trip[key];
    if (slot && id && overlaps(slot, window)) ids.add(id);
  }
  return ids;
}

function sameDay(iso: string): boolean {
  const planned = new Date(iso);
  const today = new Date();
  return planned.getFullYear() === today.getFullYear()
    && planned.getMonth() === today.getMonth()
    && planned.getDate() === today.getDate();
}

function scheduleTime(trip: TripRecord): number {
  const first = trip.stops[0]?.scheduledAt;
  return first ? new Date(first).getTime() : Number.POSITIVE_INFINITY;
}

function groupOf(status: string): "live" | "queue" | "history" {
  if (LIVE.has(status)) return "live";
  if (status === "completed" || status === "closed" || status === "canceled") return "history";
  return "queue";
}

export default function TripsSection({
  trips,
  customers,
  drivers,
  vehicles,
  canWrite,
  ownDriverId,
}: {
  trips: TripRecord[];
  customers: CustomerRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  canWrite: boolean;
  ownDriverId: string | null;
}) {
  const router = useRouter();
  const { error, setError, saving, submit } = useFleetSave();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeStop, setActiveStop] = useState(0);
  const [driverFilter, setDriverFilter] = useState(ownDriverId ?? "");
  const booking = draft ? draftWindow(draft.stops) : null;
  const busyDrivers = booking ? bookedIds(trips, draft?.id ?? null, booking, "driverId") : new Set<string>();
  const busyTrucks = booking ? bookedIds(trips, draft?.id ?? null, booking, "vehicleId") : new Set<string>();
  useEffect(() => {
    if (ownDriverId) return;
    const interval = window.setInterval(() => router.refresh(), 20000);
    return () => window.clearInterval(interval);
  }, [ownDriverId, router]);
  const myLive = ownDriverId
    ? trips.find((trip) => trip.driverId === ownDriverId && LIVE.has(trip.status)) ?? null
    : null;

  useEffect(() => {
    if (!draft || !booking) return;
    const driverTaken = Boolean(draft.driverId && bookedIds(trips, draft.id, booking, "driverId").has(draft.driverId));
    const truckTaken = Boolean(draft.vehicleId && bookedIds(trips, draft.id, booking, "vehicleId").has(draft.vehicleId));
    if (!driverTaken && !truckTaken) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        driverId: driverTaken ? "" : current.driverId,
        vehicleId: truckTaken ? "" : current.vehicleId,
      };
    });
    setError(driverTaken ? "That driver is already booked for this time." : "That truck is already booked for this time.");
  }, [booking?.start, booking?.end, draft, draft?.driverId, draft?.vehicleId, trips, setError]);
  const visible = trips.filter((trip) => !driverFilter || trip.driverId === driverFilter);
  const live = visible.filter((trip) => groupOf(trip.status) === "live");
  const queue = visible
    .filter((trip) => groupOf(trip.status) === "queue")
    .sort((a, b) => scheduleTime(a) - scheduleTime(b) || a.createdAt.localeCompare(b.createdAt));
  const history = visible
    .filter((trip) => groupOf(trip.status) === "history")
    .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt));
  const liveDriverIds = new Set(trips.filter((trip) => LIVE.has(trip.status)).map((trip) => trip.driverId));
  const trucks = vehicles.filter((vehicle) => vehicle.status !== "retired" && vehicle.status !== "maintenance");

  function edit(trip: TripRecord) {
    setError(null);
    setDraft({
      id: trip.id,
      customerId: trip.customerId ?? "",
      customerName: trip.customerName,
      customerPhone: "",
      customerEmail: trip.customerEmail ?? "",
      loadType: trip.loadType ?? "",
      weightKg: trip.weightKg == null ? "" : String(trip.weightKg),
      deadlineAt: toLocal(trip.deadlineAt),
      notes: trip.notes ?? "",
      driverId: trip.driverId ?? "",
      vehicleId: trip.vehicleId ?? "",
      emptyRun: trip.emptyRun,
      etaAt: toLocal(trip.etaAt),
      fromCopy: false,
      stops: trip.stops.length >= 2
        ? trip.stops.map((stop) => ({
            kind: stop.kind,
            address: stop.address ?? "",
            latitude: stop.latitude,
            longitude: stop.longitude,
            scheduledAt: toLocal(stop.scheduledAt),
          }))
        : blankStops(),
    });
  }

  function copyTrip(trip: TripRecord) {
    setError(null);
    setActiveStop(0);
    setDraft({
      id: null,
      customerId: trip.customerId ?? "",
      customerName: trip.customerName,
      customerPhone: "",
      customerEmail: trip.customerEmail ?? "",
      loadType: trip.loadType ?? "",
      weightKg: trip.weightKg == null ? "" : String(trip.weightKg),
      deadlineAt: "",
      notes: trip.notes ?? "",
      driverId: trip.driverId ?? "",
      vehicleId: trip.vehicleId ?? "",
      emptyRun: trip.emptyRun,
      etaAt: "",
      fromCopy: true,
      stops: trip.stops.length >= 2
        ? trip.stops.map((stop) => ({
            kind: stop.kind,
            address: stop.address ?? "",
            latitude: stop.latitude,
            longitude: stop.longitude,
            scheduledAt: "",
          }))
        : blankStops(),
    });
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const ok = await submit(draft.id ? `/api/company/trips/${draft.id}` : "/api/company/trips", draft.id ? "PATCH" : "POST", {
      customerId: draft.customerId || null,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerEmail: draft.customerEmail,
      loadType: draft.loadType,
      weightKg: draft.weightKg,
      deadlineAt: draft.deadlineAt,
      notes: draft.notes,
      driverId: draft.driverId,
      vehicleId: draft.vehicleId,
      emptyRun: draft.emptyRun,
      etaAt: draft.etaAt,
      stops: draft.stops,
    });
    if (ok) {
      setDraft(null);
      setActiveStop(0);
    }
  }

  function readLocation(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    });
  }

  async function progress(trip: TripRecord, action: string) {
    const needsPlace = ownDriverId && (action === "loading" || action === "unloading" || action === "arrive");
    let here: { latitude: number; longitude: number } | null = null;
    if (needsPlace) {
      here = await readLocation();
      if (!here) {
        setError("Location is required");
        return;
      }
      const stop = action === "loading"
        ? trip.stops[0]
        : action === "unloading"
          ? trip.stops[trip.stops.length - 1]
          : trip.stops.find((item) => !item.arrivedAt);
      if (stop?.latitude != null && stop.longitude != null) {
        const meters = metersBetween(
          { lat: here.latitude, lng: here.longitude },
          { lat: stop.latitude, lng: stop.longitude }
        );
        if (meters > STOP_RANGE_METERS) {
          setError(action === "loading" ? pickupAwayMessage() : stopAwayMessage(placeTitle(stop.address)));
          return;
        }
      }
    }
    if (action === "arrive") {
      await submit(`/api/company/trips/${trip.id}/arrive`, "POST", here);
      return;
    }
    const saved = await submit(`/api/company/trips/${trip.id}/status`, "POST", {
      status: action,
      ...(here ?? {}),
    });
    if (action === "started" && saved && (saved as { emailError?: string | null }).emailError) {
      setError("The trip started. The tracking email could not be sent. Use Send again on the trip.");
    }
  }

  return (
    <SectionCard
      title={ownDriverId ? "Your trips" : "Trips"}
      caption={
        ownDriverId
          ? "Trips waiting for you, the one you are on, and the ones you have finished."
          : "A driver or truck already booked between the start and the end will not be offered."
      }
      action={
        canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft(blank()); }}>
            New trip
          </button>
        ) : null
      }
    >
      {!ownDriverId ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          <FilterButton current={driverFilter === ""} onClick={() => setDriverFilter("")} label="All drivers" />
          {drivers.map((driver) => {
            const queued = trips.filter((trip) => trip.driverId === driver.id && trip.status === "assigned").length;
            const onTrip = liveDriverIds.has(driver.id);
            return (
              <FilterButton
                key={driver.id}
                current={driverFilter === driver.id}
                onClick={() => setDriverFilter(driver.id)}
                label={`${driver.fullName} · ${onTrip ? "On a trip" : "Free"}${queued ? ` · ${queued} queued` : ""}`}
              />
            );
          })}
        </div>
      ) : null}

      {ownDriverId ? null : <AdminLiveTrips trips={trips} />}

      {myLive ? (
        <DriverRoute trip={myLive} busy={saving} onProgress={(action) => progress(myLive, action)} />
      ) : null}

      <Alert message={error} onClose={() => setError(null)} />

      {draft ? (
        <form ref={formRef} onSubmit={save} className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2">
          {draft.fromCopy ? (
            <p className="text-sm text-ink sm:col-span-2">
              Places, customer, driver, and truck are copied. Set the new dates, then assign it.
            </p>
          ) : null}
          <Field label="Customer">
            <select
              value={draft.customerId}
              onChange={(e) => {
                const customerId = e.target.value;
                const customer = customers.find((item) => item.id === customerId);
                setDraft({ ...draft, customerId, customerEmail: customer?.email ?? "" });
              }}
              className={fieldClass}
            >
              <option value="">New customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </Field>
          {draft.customerId ? null : (
            <>
              <Field label="Customer name">
                <input required value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} className={fieldClass} />
              </Field>
              <Field label="Customer phone">
                <input value={draft.customerPhone} onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })} className={fieldClass} inputMode="tel" />
              </Field>
            </>
          )}
          <Field label="Customer email">
            <input
              required
              type="email"
              value={draft.customerEmail}
              onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <p className="text-sm text-muted sm:col-span-2">
            This address receives the tracking link when the trip starts. The page shows status, the latest place, and the trip photos. It stops when the shipment is delivered.
          </p>
          <Field label="Load">
            <input value={draft.loadType} onChange={(e) => setDraft({ ...draft, loadType: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Weight (kg)">
            <input value={draft.weightKg} onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })} className={fieldClass} inputMode="decimal" />
          </Field>
          <Field label="Deadline">
            <input type="datetime-local" value={draft.deadlineAt} onChange={(e) => setDraft({ ...draft, deadlineAt: e.target.value })} className={fieldClass} />
          </Field>
          <p className="text-sm text-muted sm:col-span-2">Type a place and choose it, or click the map. The blue pin is the stop you are editing.</p>
          {draft.stops.map((stop, index) => (
            <div key={`${stop.kind}-${index}`} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              <PlaceSearch
                label={index === 0 ? "Start" : index === draft.stops.length - 1 ? "End" : `Stop ${index + 1}`}
                value={stop}
                onFocus={() => setActiveStop(index)}
                onChange={(place) => {
                  const stops = draft.stops.slice();
                  stops[index] = { ...stop, ...place };
                  setDraft({ ...draft, stops });
                  setActiveStop(index);
                }}
              />
              <Field label={index === 0 ? "Start time" : index === draft.stops.length - 1 ? "End time" : "Stop time"}>
                <input
                  type="datetime-local"
                  required={index === 0 || index === draft.stops.length - 1}
                  value={stop.scheduledAt}
                  onChange={(e) => {
                    const stops = draft.stops.slice();
                    stops[index] = { ...stop, scheduledAt: e.target.value };
                    setDraft({ ...draft, stops });
                  }}
                  className={fieldClass}
                />
              </Field>
            </div>
          ))}
          <div className="sm:col-span-2">
            <TripMap
              stops={draft.stops}
              activeIndex={Math.min(activeStop, draft.stops.length - 1)}
              onActive={setActiveStop}
              onPick={(index, place) => {
                setDraft((current) => {
                  if (!current) return current;
                  const stops = current.stops.slice();
                  const stop = stops[index];
                  if (!stop) return current;
                  stops[index] = { ...stop, ...place };
                  return { ...current, stops };
                });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="button"
              className={quietBtn}
              onClick={() => {
                const stops = draft.stops.slice();
                stops.splice(stops.length - 1, 0, { kind: "drop", address: "", latitude: null, longitude: null, scheduledAt: "" });
                setDraft({ ...draft, stops });
              }}
            >
              Add drop
            </button>
            {draft.stops.length > 2 ? (
              <button
                type="button"
                className={quietBtn}
                onClick={() => {
                  const stops = draft.stops.slice();
                  stops.splice(stops.length - 2, 1);
                  setDraft({ ...draft, stops });
                }}
              >
                Remove last drop
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.emptyRun}
                onChange={(e) => setDraft({ ...draft, emptyRun: e.target.checked })}
              />
              Empty run
            </label>
          </div>
          <p className="text-sm text-muted sm:col-span-2">
            {booking
              ? "Drivers and trucks already booked for this time are hidden. A trip that only touches the end of another can still be assigned."
              : "Set the start and end time to see who is free."}
          </p>
          <Field label="Driver">
            <select required disabled={!booking} value={draft.driverId} onChange={(e) => setDraft({ ...draft, driverId: e.target.value })} className={fieldClass}>
              <option value="" disabled>{booking ? "Choose" : "Set the times first"}</option>
              {drivers.filter((driver) => (driver.status === "active" || driver.id === draft.driverId) && !busyDrivers.has(driver.id)).map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.fullName}</option>
              ))}
            </select>
          </Field>
          {booking && !drivers.some((driver) => driver.status === "active" && !busyDrivers.has(driver.id)) ? (
            <p className="text-sm text-ink sm:col-span-2">No driver is free between these times.</p>
          ) : null}
          <Field label="Truck">
            <select required disabled={!booking} value={draft.vehicleId} onChange={(e) => setDraft({ ...draft, vehicleId: e.target.value })} className={fieldClass}>
              <option value="" disabled>{booking ? "Choose" : "Set the times first"}</option>
              {trucks.filter((vehicle) => !busyTrucks.has(vehicle.id)).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>
              ))}
              {draft.vehicleId && !trucks.some((vehicle) => vehicle.id === draft.vehicleId) && !busyTrucks.has(draft.vehicleId) ? (
                <option value={draft.vehicleId}>{vehicles.find((vehicle) => vehicle.id === draft.vehicleId)?.registrationNumber ?? "Truck"}</option>
              ) : null}
            </select>
          </Field>
          <Field label="Notes">
            <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={fieldClass} />
          </Field>
          <Actions saving={saving} label={draft.id ? "Save trip" : draft.fromCopy ? "Assign copied trip" : "Assign trip"} onCancel={() => { setDraft(null); setError(null); }} />
        </form>
      ) : null}

      <TripGroup
        title="On the road"
        empty="No live trips."
        trips={live}
        queue={queue}
        liveDriverIds={liveDriverIds}
        canWrite={canWrite}
        ownDriverId={ownDriverId}
        saving={saving}
        onEdit={edit}
        onStatus={(trip, status) => progress(trip, status)}
      />
      <TripGroup
        title="Queue"
        empty="No trips waiting."
        trips={queue}
        queue={queue}
        liveDriverIds={liveDriverIds}
        canWrite={canWrite}
        ownDriverId={ownDriverId}
        saving={saving}
        onEdit={edit}
        onStatus={(trip, status) => progress(trip, status)}
      />
      <TripGroup
        title="History"
        caption="Finished, closed, and canceled trips."
        emphasis
        empty="No past trips."
        trips={history}
        queue={queue}
        liveDriverIds={liveDriverIds}
        canWrite={canWrite}
        ownDriverId={ownDriverId}
        saving={saving}
        onEdit={edit}
        onCopy={copyTrip}
        onStatus={(trip, status) => progress(trip, status)}
      />
    </SectionCard>
  );
}

function FilterButton({ current, label, onClick }: { current: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-md border-2 px-3 py-2 text-sm ${
        current ? "border-ink bg-ink font-extrabold text-paper" : "border-ink bg-paper text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function TrackingShare({ trip }: { trip: TripRecord }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ended = trip.status === "completed" || trip.status === "closed" || trip.status === "canceled";
  const waiting = trip.status === "created" || trip.status === "assigned";
  const href = trip.trackingToken ? `/track/${trip.trackingToken}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      setNote("Link copied");
    } catch {
      setNote("Copy the link from the address above");
    }
  }

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`/api/company/trips/${trip.id}/tracking`, { method: "POST" });
      const body = (await response.json()) as { error?: string; emailError?: string | null };
      if (!response.ok) throw new Error(body.error ?? "The tracking email could not be sent");
      if (body.emailError) throw new Error("The tracking email could not be sent. Copy the link instead.");
      setNote(trip.customerEmail ? `Sent to ${trip.customerEmail}` : "Sent");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The tracking email could not be sent");
    } finally {
      setBusy(false);
    }
  }

  if (!href) return null;
  if (ended) {
    return (
      <p className="mt-3 text-sm text-ink">
        {trip.status === "canceled"
          ? "The customer link ended because the shipment was canceled."
          : "The customer link ended when the shipment was delivered."}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm text-ink">
        {waiting
          ? "The customer receives this link when the trip starts. "
          : trip.customerEmail
            ? `Tracking email goes to ${trip.customerEmail}. `
            : "Add a customer email before the next start. "}
        <a className="break-all font-extrabold text-ink" href={href}>{href}</a>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={quietBtn} onClick={() => void copy()}>Copy link</button>
        {trip.customerEmail ? (
          <button type="button" className={quietBtn} disabled={busy} onClick={() => void resend()}>
            {busy ? "Sending" : "Send again"}
          </button>
        ) : null}
      </div>
      {note ? <p className="text-sm text-ink">{note}</p> : null}
    </div>
  );
}

function TripCard({
  trip,
  queue,
  liveDriverIds,
  canWrite,
  ownDriverId,
  saving,
  past,
  onEdit,
  onCopy,
  onStatus,
}: {
  trip: TripRecord;
  queue: TripRecord[];
  liveDriverIds: Set<string | null>;
  canWrite: boolean;
  ownDriverId: string | null;
  saving: boolean;
  past?: boolean;
  onEdit: (trip: TripRecord) => void;
  onCopy?: (trip: TripRecord) => void;
  onStatus: (trip: TripRecord, status: string) => void;
}) {
  const [pending, setPending] = useState<{ message: string; run: () => void } | null>(null);
  const legs = useDrivingLegs(trip.stops);
  const total = legs?.reduce((sum, meters) => sum + meters, 0) ?? null;
  const place = queue.filter((item) => item.driverId === trip.driverId).findIndex((item) => item.id === trip.id);
  const waiting = trip.status === "assigned" && liveDriverIds.has(trip.driverId);
  const action = NEXT_ACTION[trip.status];
  const mine = Boolean(ownDriverId && trip.driverId === ownDriverId);
  const lastStop = trip.stops[trip.stops.length - 1];
  const pendingStop = trip.stops.find((stop) => !stop.arrivedAt);
  const reachingMiddle = trip.status === "in_transit" && pendingStop && lastStop && pendingStop.id !== lastStop.id;
  const canMove = canWrite || mine;
  const badge = place >= 0 ? (place === 0 ? "Next" : `Queue ${place + 1}`) : statusLabel(trip.status);
  const facts = [
    trip.driverName ?? "No driver",
    trip.vehicleRegistration ?? "No truck",
    trip.loadType,
    trip.weightKg != null ? `${trip.weightKg} kg` : null,
    total != null ? formatKm(total) : null,
    trip.emptyRun ? "Empty run" : null,
    trip.deadlineAt ? `Deadline ${when(trip.deadlineAt)}` : null,
  ].filter(Boolean);

  return (
    <li className={past ? "border-2 border-ink bg-paper-subtle p-5 sm:p-6" : "border-2 border-ink bg-paper p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={past ? "text-2xl font-extrabold text-ink" : "text-lg font-extrabold text-ink"}>{trip.customerName}</h3>
          <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>
        </div>
        <span className="rounded-md border-2 border-ink px-2 py-1 text-xs font-extrabold uppercase tracking-wider text-ink">
          {badge}
        </span>
      </div>
      {waiting ? (
        <p className="mt-3 text-sm text-ink">{trip.driverName ?? "This driver"} is already on a trip. This one waits.</p>
      ) : null}
      <ol className="mt-4">
        {trip.stops.map((stop, index) => {
          const placeName = placeParts(stop.address);
          const last = index === trip.stops.length - 1;
          const leg = legs?.[index];
          return (
            <li key={stop.id} className="grid grid-cols-[1.5rem_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink text-[11px] font-extrabold text-ink">
                  {index + 1}
                </span>
                {last ? null : <span className="my-1 w-0.5 flex-1 bg-ink" />}
              </div>
              <div className={last ? "" : "pb-4"}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {stopLabel(index, stop.kind, trip.stops.length)}
                </p>
                <p className="text-sm font-extrabold text-ink">{placeName.title}</p>
                {placeName.detail ? <p className="text-sm text-muted">{placeName.detail}</p> : null}
                <p className="text-sm text-muted">{when(stop.scheduledAt)}</p>
                {!last && leg != null ? (
                  <p className="mt-2 text-sm font-extrabold text-ink">{formatKm(leg)} to the next stop</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {trip.notes ? <p className="mt-3 text-sm text-ink">{trip.notes}</p> : null}
      {!ownDriverId ? <TrackingShare trip={trip} /> : null}
      <ProofStrip proofs={trip.proofs ?? []} />
      {canMove || (canWrite && onCopy) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite && (trip.status === "assigned" || trip.status === "created") ? (
            <button type="button" className={quietBtn} disabled={saving} onClick={() => onEdit(trip)}>Edit</button>
          ) : null}
          {canWrite && onCopy ? (
            <button type="button" className={quietBtn} disabled={saving} onClick={() => onCopy(trip)}>
              Save as new trip
            </button>
          ) : null}
          {reachingMiddle ? (
            <button type="button" className={primaryBtn} disabled={saving} onClick={() => onStatus(trip, "arrive")}>
              I reached this stop
            </button>
          ) : null}
          {!reachingMiddle && action && (canWrite || action.status !== "closed") ? (
            <button
              type="button"
              className={mine && (action.status === "started" || action.status === "loading") ? primaryBtn : quietBtn}
              disabled={saving}
              onClick={() => {
                const start = trip.stops[0]?.scheduledAt;
                if (mine && action.status === "started" && start && !sameDay(start)) {
                  setPending({
                    message: `This trip starts on ${when(start)}. Do you really want to start it today?`,
                    run: () => onStatus(trip, action.status),
                  });
                  return;
                }
                onStatus(trip, action.status);
              }}
            >
              {action.label}
            </button>
          ) : null}
          {mine && trip.status === "started" ? (
            <button
              type="button"
              className={quietBtn}
              disabled={saving}
              onClick={() => setPending({
                message: "Discard this start and put the trip back in your queue?",
                run: () => onStatus(trip, "assigned"),
              })}
            >
              Discard and start again
            </button>
          ) : null}
          {canWrite && trip.status !== "completed" && trip.status !== "closed" && trip.status !== "canceled" ? (
            <button
              type="button"
              className={quietBtn}
              disabled={saving}
              onClick={() => setPending({ message: "Cancel this trip?", run: () => onStatus(trip, "canceled") })}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {pending ? (
        <Modal
          message={pending.message}
          confirmLabel="OK"
          cancelLabel="Cancel"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const run = pending.run;
            setPending(null);
            run();
          }}
        />
      ) : null}
    </li>
  );
}

function TripGroup({
  title,
  caption,
  emphasis,
  empty,
  trips,
  queue,
  liveDriverIds,
  canWrite,
  ownDriverId,
  saving,
  onEdit,
  onCopy,
  onStatus,
}: {
  title: string;
  caption?: string;
  emphasis?: boolean;
  empty: string;
  trips: TripRecord[];
  queue: TripRecord[];
  liveDriverIds: Set<string | null>;
  canWrite: boolean;
  ownDriverId: string | null;
  saving: boolean;
  onEdit: (trip: TripRecord) => void;
  onCopy?: (trip: TripRecord) => void;
  onStatus: (trip: TripRecord, status: string) => void;
}) {
  return (
    <div className={emphasis ? "mt-10 border-t-4 border-ink pt-6" : "mt-6"}>
      <h2 className={emphasis ? "text-3xl font-extrabold text-ink" : "text-lg font-extrabold text-ink"}>{title}</h2>
      {caption ? <p className="mt-1 text-sm text-muted">{caption}</p> : null}
      {trips.length === 0 ? <p className="mt-2 text-sm text-ink-soft">{empty}</p> : (
        <ul className={emphasis ? "mt-4 space-y-4" : "mt-3 space-y-3"}>
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              queue={queue}
              liveDriverIds={liveDriverIds}
              canWrite={canWrite}
              ownDriverId={ownDriverId}
              saving={saving}
              past={emphasis}
              onEdit={onEdit}
              onCopy={onCopy}
              onStatus={onStatus}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
