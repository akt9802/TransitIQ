"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { ProofCapture } from "@/components/dashboard/ProofPhotos";
import { primaryBtn, quietBtn } from "@/components/dashboard/styles";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import {
  metersBetween,
  placeTitle,
  pickupAwayMessage,
  reachedMessage,
  STOP_RANGE_METERS,
  stopAwayMessage,
} from "@/lib/company/geo";
import type { TripRecord, TripStopRecord } from "@/lib/company/types";

type Point = { lat: number; lng: number };
type Step = Point & { instruction: string; meters: number };

function point(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.latLng && typeof raw.latLng === "object") return point(raw.latLng);
  if (typeof raw.latitude === "number" && typeof raw.longitude === "number") {
    return { lat: raw.latitude, lng: raw.longitude };
  }
  const lat = typeof raw.lat === "function" ? (raw.lat as () => number)() : raw.lat;
  const lng = typeof raw.lng === "function" ? (raw.lng as () => number)() : raw.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function spoken(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? Math.round(km) : Math.round(km * 10) / 10} km`;
  }
  return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
}

function spokenTime(millis: number | null | undefined): string | null {
  if (!millis || !Number.isFinite(millis)) return null;
  const minutes = Math.max(1, Math.round(millis / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function targetStop(trip: TripRecord): TripStopRecord | null {
  if (trip.status === "started" || trip.status === "loading") return trip.stops[0] ?? null;
  if (trip.status === "unloading") return trip.stops[trip.stops.length - 1] ?? null;
  return trip.stops.find((stop) => !stop.arrivedAt) ?? trip.stops[trip.stops.length - 1] ?? null;
}

export default function DriverRoute({
  trip,
  busy,
  onProgress,
}: {
  trip: TripRecord;
  busy: boolean;
  onProgress: (action: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const hereRef = useRef<google.maps.Marker | null>(null);
  const stopMarkers = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [path, setPath] = useState<Point[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [legMeters, setLegMeters] = useState<number | null>(null);
  const [legMillis, setLegMillis] = useState<number | null>(null);
  const [here, setHere] = useState<Point | null>(null);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const target = targetStop(trip);
  const targetPoint = target?.latitude != null && target.longitude != null
    ? { lat: target.latitude, lng: target.longitude }
    : null;
  const targetKey = `${trip.status}:${target?.id ?? ""}`;
  const hereBucket = here ? `${Math.round(here.lat * 200) / 200},${Math.round(here.lng * 200) / 200}` : "";
  const hereRefPoint = useRef<Point | null>(null);
  const destRef = useRef<Point | null>(null);
  hereRefPoint.current = here;
  destRef.current = targetPoint;
  const place = placeTitle(target?.address ?? null);
  const away = here && targetPoint ? metersBetween(here, targetPoint) : null;
  const near = away != null && away <= STOP_RANGE_METERS;
  const lastStop = trip.stops[trip.stops.length - 1];
  const middle = trip.status === "in_transit" && target && lastStop && target.id !== lastStop.id;
  const pickupPhotos = (trip.proofs ?? []).filter((photo) => photo.kind === "pickup").length;
  const deliveryPhotos = (trip.proofs ?? []).filter((photo) => photo.kind === "delivery").length;
  const current = steps[0];
  const upcoming = steps.slice(1, 4);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationBlocked(true);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setLocationBlocked(false);
        setHere({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setLocationBlocked(true),
      { enableHighAccuracy: true, maximumAge: 4000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  useEffect(() => {
    const origin = hereRefPoint.current;
    const destination = destRef.current;
    if (!origin || !destination) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(async () => {
        const routesLibrary = (await google.maps.importLibrary("routes")) as google.maps.RoutesLibrary;
        const request = {
          origin,
          destination,
          travelMode: "DRIVING",
          polylineQuality: "HIGH_QUALITY",
          fields: ["path", "legs", "legs.steps", "distanceMeters", "durationMillis"],
        };
        let routes: google.maps.routes.Route[] | undefined;
        try {
          routes = (await routesLibrary.Route.computeRoutes(request as never)).routes;
        } catch {
          routes = (await routesLibrary.Route.computeRoutes({
            origin,
            destination,
            travelMode: "DRIVING",
            fields: ["path", "legs"],
          } as never)).routes;
        }
        if (cancelled) return;
        const route = routes?.[0];
        const drawn = (route?.path ?? []).map(point).filter((item): item is Point => item !== null);
        setPath(drawn.length > 1 ? drawn : [origin, destination]);
        setLegMeters(route?.distanceMeters ?? null);
        setLegMillis(route?.durationMillis ?? null);
        const found: Step[] = [];
        route?.legs?.[0]?.steps?.forEach((step) => {
          const at = point(step.startLocation) ?? point(step.path?.[0]) ?? origin;
          const text = step.instructions?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (text) found.push({ ...at, instruction: text, meters: step.distanceMeters ?? 0 });
        });
        setSteps(found);
      })
      .catch(() => {
        if (cancelled) return;
        setPath([origin, destination]);
        setSteps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hereBucket, targetKey]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: targetPoint ?? { lat: 22.5, lng: 79 },
          zoom: 14,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
        setMapReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [trip.id]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    lineRef.current?.setMap(null);
    stopMarkers.current.forEach((marker) => marker.setMap(null));
    stopMarkers.current = [];
    if (path.length > 1) {
      lineRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      });
    }
    trip.stops.forEach((stop, index) => {
      if (stop.latitude == null || stop.longitude == null) return;
      const active = stop.id === target?.id;
      stopMarkers.current.push(new google.maps.Marker({
        map,
        position: { lat: stop.latitude, lng: stop.longitude },
        label: { text: String(index + 1), color: "#ffffff", fontWeight: "700" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: active ? 14 : 10,
          fillColor: active ? "#2563eb" : "#171717",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      }));
    });
  }, [mapReady, path, target?.id, trip.stops]);

  useEffect(() => {
    if (!mapReady || !here) return;
    const map = mapRef.current;
    if (!map) return;
    if (!hereRef.current) {
      hereRef.current = new google.maps.Marker({
        map,
        position: here,
        title: "You",
        zIndex: 10,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    } else {
      hereRef.current.setPosition(here);
    }
    map.panTo(here);
    if ((map.getZoom() ?? 0) < 14) map.setZoom(16);
  }, [mapReady, here]);

  const time = spokenTime(legMillis);
  const guide = current
    ? `${current.instruction}${current.meters ? ` · ${spoken(current.meters)}` : ""}`
    : `Head towards ${place}`;

  return (
    <section className="mt-4 border-2 border-ink bg-paper">
      <div className="border-b-2 border-ink px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {near ? "Reached" : "Directions"}
          {legMeters != null ? ` · ${spoken(legMeters)}` : ""}
          {time ? ` · ${time}` : ""}
        </p>
        <h2 className="text-xl font-extrabold text-ink">{place}</h2>
        <p className="mt-1 text-base font-extrabold text-ink">{guide}</p>
        {upcoming.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {upcoming.map((step) => (
              <li key={`${step.instruction}-${step.lat}-${step.lng}`} className="text-sm text-muted">
                Then {step.instruction}{step.meters ? ` · ${spoken(step.meters)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {near ? (
          <p className="mt-3 border-2 border-ink bg-accent-soft px-3 py-2 text-sm font-extrabold text-ink">
            {reachedMessage(place)}
          </p>
        ) : away != null && trip.status === "started" ? (
          <p className="mt-3 border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm font-extrabold text-ink">
            {spoken(away)} away. {pickupAwayMessage()}
          </p>
        ) : away != null ? (
          <p className="mt-3 text-sm text-ink">{spoken(away)} from {place}.</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Finding your location for directions.</p>
        )}
        {locationBlocked ? (
          <p className="mt-2 text-sm text-muted">Allow location so the directions can start from where you are.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {trip.status === "started" ? (
            <>
              <button type="button" className={primaryBtn} disabled={busy} onClick={() => onProgress("loading")}>
                Start loading
              </button>
              <button type="button" className={quietBtn} disabled={busy} onClick={() => setDiscarding(true)}>
                Discard and start again
              </button>
            </>
          ) : null}
          {trip.status === "loading" ? (
            <button type="button" className={primaryBtn} disabled={busy || pickupPhotos < 2} onClick={() => onProgress("in_transit")}>
              On the road
            </button>
          ) : null}
          {middle ? (
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => onProgress("arrive")}>
              I reached this stop
            </button>
          ) : null}
          {trip.status === "in_transit" && !middle ? (
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => onProgress("unloading")}>
              Start unloading
            </button>
          ) : null}
          {trip.status === "unloading" ? (
            <button type="button" className={primaryBtn} disabled={busy || deliveryPhotos < 2} onClick={() => onProgress("completed")}>
              Complete trip
            </button>
          ) : null}
          <a href="/dashboard?section=fuel" className={`${quietBtn} inline-block no-underline`}>Add fuel</a>
        </div>
        {trip.status === "loading" || trip.status === "unloading" ? (
          <ProofCapture
            tripId={trip.id}
            kind={trip.status === "loading" ? "pickup" : "delivery"}
            proofs={trip.proofs ?? []}
          />
        ) : null}
      </div>
      <div ref={containerRef} className="h-[70vh] min-h-96 w-full" />
      {discarding ? (
        <Modal
          message="Discard this start and put the trip back in your queue?"
          confirmLabel="OK"
          cancelLabel="Cancel"
          onCancel={() => setDiscarding(false)}
          onConfirm={() => {
            setDiscarding(false);
            onProgress("assigned");
          }}
        />
      ) : null}
    </section>
  );
}
