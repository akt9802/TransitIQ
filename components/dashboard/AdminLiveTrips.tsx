"use client";

import { useEffect, useState } from "react";
import LiveTrail from "@/components/maps/LiveTrail";
import { metersBetween, placeTitle } from "@/lib/company/geo";
import type { TripRecord, TripStopRecord } from "@/lib/company/types";
import { LIVE_TRIP_STATUSES, TRIP_STATUSES } from "@/lib/company/types";

type Trail = {
  tripId: string;
  driverId: string;
  points: { latitude: number; longitude: number; recordedAt: string; tripId: string | null }[];
};

type Here = { latitude: number; longitude: number; recordedAt: string };

const LIVE = new Set<string>(LIVE_TRIP_STATUSES);

function statusLabel(status: string) {
  return TRIP_STATUSES.find((item) => item.key === status)?.label ?? status;
}

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatKm(meters: number) {
  const km = meters / 1000;
  const rounded = km >= 100 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded.toLocaleString("en-IN")} km`;
}

function stopName(index: number, kind: string, total: number) {
  if (index === 0) return "Pickup";
  if (index === total - 1) return kind === "return" ? "Return" : "Delivery";
  return kind === "return" ? "Return" : `Stop ${index + 1}`;
}

function done(stop: TripStopRecord, index: number, total: number) {
  if (index === 0 || index === total - 1) return Boolean(stop.departedAt);
  return Boolean(stop.arrivedAt);
}

function distanceLine(stop: TripStopRecord, here: Here | null) {
  if (!here) return "Distance waits for a location";
  if (stop.latitude == null || stop.longitude == null) return "This stop has no map point";
  const meters = metersBetween(
    { lat: here.latitude, lng: here.longitude },
    { lat: stop.latitude, lng: stop.longitude }
  );
  return `${formatKm(meters)} from the truck, in a straight line`;
}

function progressLine(trip: TripRecord, here: Here | null) {
  const stops = trip.stops;
  const total = stops.length;
  const nextIndex = stops.findIndex((stop, index) => !done(stop, index, total));
  if (nextIndex < 0) return "Every stop on this trip is done.";
  const next = stops[nextIndex];
  const place = placeTitle(next.address);
  if (next.arrivedAt && !next.departedAt) {
    return `At ${place} since ${when(next.arrivedAt)}.`;
  }
  const away = distanceLine(next, here);
  return `Heading to ${place}. ${away}.`;
}

function pickupLine(trip: TripRecord) {
  const pickup = trip.stops[0];
  const photos = trip.proofs.filter((proof) => proof.kind === "pickup").length;
  if (!pickup) return "No pickup is set.";
  if (pickup.departedAt) return `Picked up. Left the pickup ${when(pickup.departedAt)}. Pickup photos ${photos}.`;
  if (pickup.arrivedAt) return `At the pickup since ${when(pickup.arrivedAt)}. Not left yet. Pickup photos ${photos}.`;
  return `Pickup not done. Pickup photos ${photos}.`;
}

export default function AdminLiveTrips({ trips }: { trips: TripRecord[] }) {
  const live = trips.filter((trip) => LIVE.has(trip.status));
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    if (live.length === 0) return;
    let stop = false;
    async function load() {
      const response = await fetch("/api/company/tracking");
      if (!response.ok || stop) return;
      const body = (await response.json()) as { trails?: Trail[] };
      if (!stop) setTrails(body.trails ?? []);
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    const interval = window.setInterval(() => {
      void load();
    }, 20000);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [live.length]);

  if (live.length === 0) return null;
  const shown = trails.filter((trail) => live.some((trip) => trip.id === trail.tripId));

  return (
    <section className="mt-4 border-2 border-ink bg-paper p-4">
      <h2 className="text-lg font-extrabold text-ink">On the road</h2>
      <p className="mt-1 text-sm text-muted">
        Each stop, whether the truck has reached it, and how far it is from the stops still ahead. Distance is a straight line from the latest shared place.
      </p>
      <ul className="mt-4 space-y-4">
        {live.map((trip) => {
          const trail = shown.find((item) => item.tripId === trip.id);
          const latest = trail?.points[trail.points.length - 1] ?? null;
          const here = latest
            ? { latitude: latest.latitude, longitude: latest.longitude, recordedAt: latest.recordedAt }
            : null;
          const deliveryPhotos = trip.proofs.filter((proof) => proof.kind === "delivery").length;
          const nextIndex = trip.stops.findIndex((stop, index) => !done(stop, index, trip.stops.length));
          return (
            <li key={trip.id} className="border-2 border-ink p-3">
              <p className="font-extrabold text-ink">{trip.customerName}</p>
              <p className="mt-1 text-sm text-ink">
                {statusLabel(trip.status)}
                {trip.driverName ? ` · ${trip.driverName}` : ""}
                {trip.vehicleRegistration ? ` · ${trip.vehicleRegistration}` : ""}
                {trip.loadType ? ` · ${trip.loadType}` : ""}
                {trip.weightKg != null ? ` · ${trip.weightKg} kg` : ""}
              </p>
              <p className="mt-2 text-sm font-extrabold text-ink">{pickupLine(trip)}</p>
              <p className="mt-1 text-sm text-ink">{progressLine(trip, here)}</p>
              <p className="mt-1 text-sm text-muted">
                {here
                  ? `Latest place ${when(here.recordedAt)} at ${here.latitude.toFixed(5)}, ${here.longitude.toFixed(5)}`
                  : "No location shared yet."}
                {trip.startedAt ? ` · Started ${when(trip.startedAt)}` : ""}
                {trip.deadlineAt ? ` · Deadline ${when(trip.deadlineAt)}` : ""}
                {` · Delivery photos ${deliveryPhotos}`}
              </p>
              <ol className="mt-3 space-y-3">
                {trip.stops.map((stop, index) => {
                  const finished = done(stop, index, trip.stops.length);
                  const current = index === nextIndex;
                  return (
                    <li key={stop.id}>
                      <p className="text-sm font-extrabold text-ink">
                        {index + 1}. {stopName(index, stop.kind, trip.stops.length)}
                        {current ? " · Next" : ""}
                        {finished ? " · Done" : ""}
                      </p>
                      <p className="text-sm text-ink">{placeTitle(stop.address)}</p>
                      <p className="text-sm text-muted">{stopState(stop, index, trip.stops.length, here)}</p>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      {shown.some((trail) => trail.points.length > 0) ? <LiveTrail trails={shown} /> : null}
    </section>
  );
}

function stopState(stop: TripStopRecord, index: number, total: number, here: Here | null) {
  const planned = stop.scheduledAt ? `Planned ${when(stop.scheduledAt)}` : "No planned time";
  if (index === 0 || index === total - 1) {
    if (stop.departedAt) return `Left ${when(stop.departedAt)}. Reached ${when(stop.arrivedAt)}. ${planned}.`;
    if (stop.arrivedAt) return `Reached ${when(stop.arrivedAt)}. Still here. ${distanceLine(stop, here)}. ${planned}.`;
    return `Not reached. ${distanceLine(stop, here)}. ${planned}.`;
  }
  if (stop.arrivedAt) return `Reached ${when(stop.arrivedAt)}. ${planned}.`;
  return `Not reached. ${distanceLine(stop, here)}. ${planned}.`;
}
