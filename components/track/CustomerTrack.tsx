"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import CustomerMap from "@/components/track/CustomerMap";
import type { CustomerTracking } from "@/lib/company/tracking-link";

const STATUS: Record<string, string> = {
  created: "Waiting to start",
  assigned: "Waiting to start",
  started: "Started",
  loading: "Loading",
  in_transit: "On the road",
  unloading: "Unloading",
};

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function stopName(kind: string, index: number, total: number) {
  if (index === 0) return "Pickup";
  if (index === total - 1) return "Delivery";
  if (kind === "return") return "Return";
  return `Stop ${index + 1}`;
}

export default function CustomerTrack({ token, initial }: { token: string; initial: CustomerTracking }) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetch(`/api/track/${token}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          setView((await response.json()) as CustomerTracking);
        })
        .catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [token]);

  if (view.expired) {
    return (
      <Expired
        companyName={view.companyName}
        reason={view.reason}
      />
    );
  }

  const latest = view.points[view.points.length - 1] ?? null;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="text-sm text-ink-soft">{view.companyName}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink">{view.customerName}</h1>
      <p className="mt-3 inline-block border-2 border-ink px-3 py-1 text-sm font-extrabold">
        {STATUS[view.status] ?? view.status}
      </p>
      <p className="mt-4 text-sm text-ink">
        {[
          view.vehicleRegistration,
          view.driverName,
          view.driverPhone,
          view.loadType,
          view.weightKg != null ? `${view.weightKg} kg` : null,
        ].filter(Boolean).join(" · ")}
      </p>

      <section className="mt-6 border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
        <h2 className="text-lg font-extrabold">Latest place</h2>
        {latest ? (
          <>
            <p className="mt-2 text-sm">
              Shared {when(latest.recordedAt)} at {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
            </p>
            {latest.speedKmh != null ? <p className="text-sm">{latest.speedKmh} km/h at that point</p> : null}
            <div className="mt-3">
              <CustomerMap points={view.points} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm">The truck has not shared a location yet.</p>
        )}
      </section>

      <section className="mt-4 border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
        <h2 className="text-lg font-extrabold">Stops</h2>
        <ol className="mt-3 space-y-3">
          {view.stops.map((stop, index) => (
            <li key={stop.sequence}>
              <p className="text-sm font-extrabold">{stopName(stop.kind, index, view.stops.length)}</p>
              <p className="text-sm">{stop.address ?? "Place not set"}</p>
              <p className="text-sm text-ink-soft">
                {stop.departedAt
                  ? `Left ${when(stop.departedAt)}`
                  : stop.arrivedAt
                    ? `Reached ${when(stop.arrivedAt)}`
                    : stop.scheduledAt
                      ? `Planned ${when(stop.scheduledAt)}`
                      : "Time not set"}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-extrabold">Photos</h2>
        {view.proofs.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No photos yet.</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {view.proofs.map((proof) => (
            <figure key={proof.id} className="border-2 border-ink bg-paper">
              <div className="relative h-48 w-full">
                <Image
                  alt={proof.kind === "pickup" ? "Pickup photo" : "Delivery photo"}
                  className="object-cover"
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  src={`/api/track/${token}/photo/${proof.id}`}
                  unoptimized
                />
              </div>
              <figcaption className="px-3 py-2 text-sm">
                {proof.kind === "pickup" ? "Pickup" : "Delivery"} · {when(proof.takenAt)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

export function Expired({ companyName, reason }: { companyName: string; reason: "delivered" | "canceled" }) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="text-sm text-ink-soft">{companyName}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink">This link has ended</h1>
      <p className="mt-4 text-sm">
        {reason === "canceled"
          ? "The shipment was canceled, so this page no longer shows the truck."
          : "The shipment was delivered, so this page no longer shows the truck."}
      </p>
    </main>
  );
}
