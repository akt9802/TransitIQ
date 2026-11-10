"use client";

import { useRouter } from "next/navigation";
import { PhotoView } from "@/components/PhotoView";
import { useEffect, useMemo, useRef, useState } from "react";
import { jpegPhoto, readHere } from "@/components/dashboard/photo";
import { Alert } from "@/components/dashboard/frame";
import { fieldClass, labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import type { VehicleRecord } from "@/lib/company/types";

type Timing = "before_trip" | "on_trip" | "after_trip" | "no_trip";

type SpendTrip = {
  id: string;
  status: string;
  customerName: string;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  completedAt: string | null;
};

type FuelFill = {
  id: string;
  registrationNumber: string | null;
  driverName: string | null;
  tripId: string | null;
  timing: Timing;
  customerName: string | null;
  filledAt: string;
  litres: number;
  amount: number;
  pricePerLitre: number;
  details: string;
  latitude: number | null;
  longitude: number | null;
};

type ExtraCost = {
  id: string;
  registrationNumber: string | null;
  driverName: string | null;
  tripId: string | null;
  timing: Timing;
  kind: "puncture" | "engine" | "other";
  customerName: string | null;
  spentAt: string;
  amount: number;
  details: string;
  latitude: number | null;
  longitude: number | null;
};

type VehicleAverage = {
  vehicleId: string;
  registrationNumber: string;
  kilometres: number;
  litres: number;
  kmPerLitre: number | null;
  fuelAmount: number;
  extraAmount: number;
};

const LIVE = ["started", "loading", "in_transit", "unloading"];
const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

const WHEN: Record<Timing, string> = {
  before_trip: "Before the trip",
  on_trip: "On this trip",
  after_trip: "After the trip",
  no_trip: "No trip",
};

const KIND: Record<ExtraCost["kind"], string> = {
  puncture: "Tyre puncture",
  engine: "Engine",
  other: "Other",
};

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function timingFor(status: string): Timing | null {
  if (status === "created" || status === "assigned") return "before_trip";
  if (LIVE.includes(status)) return "on_trip";
  if (status === "completed" || status === "closed") return "after_trip";
  return null;
}

function stamp(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function place(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return "";
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export default function FuelSection({
  mine,
  vehicles,
  trips,
}: {
  mine: boolean;
  vehicles: VehicleRecord[];
  trips: SpendTrip[];
}) {
  const router = useRouter();
  const fuelPhoto = useRef<HTMLInputElement>(null);
  const costPhoto = useRef<HTMLInputElement>(null);
  const choices = useMemo(
    () =>
      trips.flatMap((trip) => {
        const timing = timingFor(trip.status);
        if (!timing || !trip.vehicleId) return [];
        if (timing === "after_trip") {
          const at = trip.completedAt ? new Date(trip.completedAt).getTime() : 0;
          if (!at || Date.now() - at > TEN_DAYS) return [];
        }
        return [{ ...trip, timing }];
      }),
    [trips]
  );
  const trucks = vehicles.filter((vehicle) => vehicle.status !== "retired");
  const live = choices.find((trip) => trip.timing === "on_trip");
  const [tripId, setTripId] = useState(live?.id ?? "");
  const [vehicleId, setVehicleId] = useState(live?.vehicleId ?? trucks[0]?.id ?? "");
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [kind, setKind] = useState<ExtraCost["kind"]>("puncture");
  const [costAmount, setCostAmount] = useState("");
  const [costDetails, setCostDetails] = useState("");
  const [fills, setFills] = useState<FuelFill[]>([]);
  const [costs, setCosts] = useState<ExtraCost[]>([]);
  const [averages, setAverages] = useState<VehicleAverage[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalLitres, setTotalLitres] = useState(0);
  const [totalExtra, setTotalExtra] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"fuel" | "cost" | null>(null);
  const [fuelFile, setFuelFile] = useState<string | null>(null);
  const [costFile, setCostFile] = useState<string | null>(null);
  const chosen = choices.find((trip) => trip.id === tripId) ?? null;
  const truckId = chosen?.vehicleId ?? vehicleId;

  async function load() {
    const response = await fetch("/api/company/fuel");
    const body = (await response.json()) as {
      error?: string;
      fills?: FuelFill[];
      costs?: ExtraCost[];
      vehicles?: VehicleAverage[];
      totalAmount?: number;
      totalLitres?: number;
      totalExtra?: number;
    };
    if (!response.ok) {
      setError(body.error ?? "Fuel could not be loaded");
      return;
    }
    setFills(body.fills ?? []);
    setCosts(body.costs ?? []);
    setAverages(body.vehicles ?? []);
    setTotalAmount(body.totalAmount ?? 0);
    setTotalLitres(body.totalLitres ?? 0);
    setTotalExtra(body.totalExtra ?? 0);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function pickTrip(next: string) {
    setTripId(next);
    const trip = choices.find((item) => item.id === next);
    if (trip?.vehicleId) setVehicleId(trip.vehicleId);
  }

  async function submitFuel(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const photo = fuelPhoto.current?.files?.[0];
    if (!photo) {
      setError("Invoice photo is required");
      return;
    }
    if (!truckId) {
      setError("Choose a truck");
      return;
    }
    setBusy("fuel");
    try {
      const here = await readHere();
      if (!here) throw new Error("Location is required");
      const invoice = await jpegPhoto(photo);
      const body = new FormData();
      body.set("vehicleId", truckId);
      if (tripId) body.set("tripId", tripId);
      body.set("litres", litres);
      body.set("amount", amount);
      body.set("details", details);
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", invoice, "invoice.jpg");
      const response = await fetch("/api/company/fuel", { method: "POST", body });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Fuel could not be saved");
      setLitres("");
      setAmount("");
      setDetails("");
      if (fuelPhoto.current) fuelPhoto.current.value = "";
      setFuelFile(null);
      await load();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fuel could not be saved");
    } finally {
      setBusy(null);
    }
  }

  async function submitCost(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const photo = costPhoto.current?.files?.[0];
    if (!photo) {
      setError("Bill photo is required");
      return;
    }
    if (!truckId) {
      setError("Choose a truck");
      return;
    }
    setBusy("cost");
    try {
      const here = await readHere();
      if (!here) throw new Error("Location is required");
      const bill = await jpegPhoto(photo);
      const body = new FormData();
      body.set("vehicleId", truckId);
      if (tripId) body.set("tripId", tripId);
      body.set("kind", kind);
      body.set("amount", costAmount);
      body.set("details", costDetails);
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", bill, "bill.jpg");
      const response = await fetch("/api/company/costs", { method: "POST", body });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Cost could not be saved");
      setCostAmount("");
      setCostDetails("");
      if (costPhoto.current) costPhoto.current.value = "";
      setCostFile(null);
      await load();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cost could not be saved");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
          <p className={labelClass}>Fuel</p>
          <p className="mt-1 text-2xl font-extrabold">{inr(totalAmount)}</p>
          <p className="text-sm text-ink-soft">{totalLitres} L</p>
        </article>
        <article className="border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
          <p className={labelClass}>Other costs</p>
          <p className="mt-1 text-2xl font-extrabold">{inr(totalExtra)}</p>
        </article>
        <article className="border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
          <p className={labelClass}>Together</p>
          <p className="mt-1 text-2xl font-extrabold">{inr(totalAmount + totalExtra)}</p>
        </article>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {mine ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Choose when this happened. No trip stays off every trip. A queued trip is marked before the trip. A running trip is marked on the trip. A trip that finished in the last 10 days is marked after the trip. The mark stays as it was written.
          </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={submitFuel} className="space-y-3 border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
            <h2 className="text-lg font-extrabold">Add fuel</h2>
            <WhenField choices={choices} tripId={tripId} onTrip={pickTrip} />
            <TruckField
              locked={Boolean(chosen)}
              registration={chosen?.vehicleRegistration ?? null}
              vehicleId={vehicleId}
              vehicles={trucks}
              onVehicle={setVehicleId}
            />
            <label className="block">
              <span className={labelClass}>Litres</span>
              <input className={fieldClass} inputMode="decimal" value={litres} onChange={(event) => setLitres(event.target.value)} required />
            </label>
            <label className="block">
              <span className={labelClass}>Amount (INR)</span>
              <input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <label className="block">
              <span className={labelClass}>Pump and fuel type</span>
              <input className={fieldClass} value={details} onChange={(event) => setDetails(event.target.value)} maxLength={200} required />
            </label>
            <PhotoPick label="Invoice photo" inputRef={fuelPhoto} fileName={fuelFile} onFile={setFuelFile} />
            <button className={primaryBtn} disabled={busy !== null} type="submit">
              {busy === "fuel" ? "Saving" : "Save fuel"}
            </button>
          </form>

          <form onSubmit={submitCost} className="space-y-3 border-2 border-ink bg-paper p-4 shadow-[var(--shadow-brutal)]">
            <h2 className="text-lg font-extrabold">Add another cost</h2>
            <WhenField choices={choices} tripId={tripId} onTrip={pickTrip} />
            <TruckField
              locked={Boolean(chosen)}
              registration={chosen?.vehicleRegistration ?? null}
              vehicleId={vehicleId}
              vehicles={trucks}
              onVehicle={setVehicleId}
            />
            <label className="block">
              <span className={labelClass}>What happened</span>
              <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as ExtraCost["kind"])}>
                <option value="puncture">Tyre puncture</option>
                <option value="engine">Engine</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Amount (INR)</span>
              <input className={fieldClass} inputMode="decimal" value={costAmount} onChange={(event) => setCostAmount(event.target.value)} required />
            </label>
            <label className="block">
              <span className={labelClass}>What was done</span>
              <input className={fieldClass} value={costDetails} onChange={(event) => setCostDetails(event.target.value)} maxLength={200} required />
            </label>
            <PhotoPick label="Bill photo" inputRef={costPhoto} fileName={costFile} onFile={setCostFile} />
            <button className={primaryBtn} disabled={busy !== null} type="submit">
              {busy === "cost" ? "Saving" : "Save cost"}
            </button>
          </form>
        </div>
        </div>
      ) : null}

      <Averages rows={averages} />

      <RecordList
        title="Fuel fills"
        empty="No fuel recorded yet."
        rows={fills.map((fill) => ({
          id: fill.id,
          kind: "fuel" as const,
          title: `${fill.litres} L · ${inr(fill.amount)}`,
          meta: `${fill.registrationNumber ?? "Truck"} · ${fill.pricePerLitre}/L · ${fill.details}`,
          who: mine ? null : fill.driverName,
          timing: fill.timing,
          customerName: fill.customerName,
          at: fill.filledAt,
          place: place(fill.latitude, fill.longitude),
        }))}
      />

      <RecordList
        title="Other costs"
        empty="No extra costs recorded yet."
        rows={costs.map((cost) => ({
          id: cost.id,
          kind: "cost" as const,
          title: `${KIND[cost.kind]} · ${inr(cost.amount)}`,
          meta: `${cost.registrationNumber ?? "Truck"} · ${cost.details}`,
          who: mine ? null : cost.driverName,
          timing: cost.timing,
          customerName: cost.customerName,
          at: cost.spentAt,
          place: place(cost.latitude, cost.longitude),
        }))}
      />
    </section>
  );
}

function WhenField({
  choices,
  tripId,
  onTrip,
}: {
  choices: (SpendTrip & { timing: Timing })[];
  tripId: string;
  onTrip: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className={labelClass}>When</span>
      <select className={fieldClass} value={tripId} onChange={(event) => onTrip(event.target.value)}>
        <option value="">No trip</option>
        {choices.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {WHEN[trip.timing]} · {trip.customerName} · {trip.vehicleRegistration ?? "Truck"}
          </option>
        ))}
      </select>
    </label>
  );
}

function TruckField({
  locked,
  registration,
  vehicleId,
  vehicles,
  onVehicle,
}: {
  locked: boolean;
  registration: string | null;
  vehicleId: string;
  vehicles: VehicleRecord[];
  onVehicle: (id: string) => void;
}) {
  if (locked) {
    return (
      <p className="text-sm font-semibold">
        Truck <span className="font-extrabold">{registration ?? "Truck"}</span>
      </p>
    );
  }
  return (
    <label className="block">
      <span className={labelClass}>Truck</span>
      <select className={fieldClass} value={vehicleId} onChange={(event) => onVehicle(event.target.value)} required>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.registrationNumber}
          </option>
        ))}
      </select>
    </label>
  );
}

function Averages({ rows }: { rows: VehicleAverage[] }) {
  return (
    <div className="overflow-x-auto border-2 border-ink bg-paper shadow-[var(--shadow-brutal)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="px-3 py-2 text-left text-xs text-ink-soft">
          Last 10 days. Kilometres use the same tracked points as Performance. Km per litre appears once both distance and litres exist.
        </caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2">Truck</th>
            <th className="px-3 py-2">Km</th>
            <th className="px-3 py-2">Litres</th>
            <th className="px-3 py-2">Km per litre</th>
            <th className="px-3 py-2">Fuel</th>
            <th className="px-3 py-2">Other</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-ink-soft" colSpan={6}>
                Not enough fuel or costs in the last 10 days.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.vehicleId} className="border-t border-ink/20">
                <td className="px-3 py-2 font-semibold">{row.registrationNumber}</td>
                <td className="px-3 py-2">{row.kilometres}</td>
                <td className="px-3 py-2">{row.litres}</td>
                <td className="px-3 py-2">{row.kmPerLitre == null ? "—" : row.kmPerLitre}</td>
                <td className="px-3 py-2">{inr(row.fuelAmount)}</td>
                <td className="px-3 py-2">{inr(row.extraAmount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PhotoPick({
  label,
  inputRef,
  fileName,
  onFile,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileName: string | null;
  onFile: (name: string | null) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={quietBtn} onClick={() => inputRef.current?.click()}>
          Choose photo
        </button>
        <span className={fileName ? "text-sm font-semibold text-ink" : "text-sm text-ink-soft"}>
          {fileName ?? "No photo chosen"}
        </span>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onFile(event.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}

function RecordList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: {
    id: string;
    kind: "fuel" | "cost";
    title: string;
    meta: string;
    who: string | null;
    timing: Timing;
    customerName: string | null;
    at: string;
    place: string;
  }[];
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-ink-soft">{empty}</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="flex gap-3 border-2 border-ink bg-paper p-3 shadow-[var(--shadow-brutal)]">
          <div className="relative h-16 w-16 shrink-0 border-2 border-ink">
            <PhotoView src={`/api/company/media/${row.kind}/${row.id}`} alt={row.title} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold">{row.title}</p>
            <p className="text-sm">{row.meta}</p>
            <p className="text-xs text-ink-soft">
              <span className="mr-2 border border-ink px-1 font-semibold uppercase">{WHEN[row.timing]}</span>
              {row.customerName ? `${row.customerName} · ` : ""}
              {row.who ? `${row.who} · ` : ""}
              {stamp(row.at)}
              {row.place ? ` · ${row.place}` : ""}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
