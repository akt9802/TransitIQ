"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, SectionCard } from "@/components/dashboard/frame";
import { jpegPhoto, readHere } from "@/components/dashboard/photo";
import { fieldClass, primaryBtn } from "@/components/dashboard/styles";
import type { VehicleRecord } from "@/lib/company/types";

type FuelFill = {
  id: string;
  registrationNumber: string | null;
  driverName: string | null;
  filledAt: string;
  litres: number;
  amount: number;
  details: string | null;
  latitude: number | null;
  longitude: number | null;
};

function money(value: number) {
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function FuelSection({
  mine,
  vehicles,
  liveTrip,
}: {
  mine: boolean;
  vehicles: VehicleRecord[];
  liveTrip: { id: string; vehicleId: string | null; vehicleRegistration: string | null } | null;
}) {
  const [fills, setFills] = useState<FuelFill[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalLitres, setTotalLitres] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [vehicleId, setVehicleId] = useState(liveTrip?.vehicleId ?? vehicles[0]?.id ?? "");
  const photoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/company/fuel");
    const data = (await response.json()) as { error?: string; fills?: FuelFill[]; totalAmount?: number; totalLitres?: number };
    if (!response.ok) {
      setError(data.error ?? "Could not load fuel");
      return;
    }
    setFills(data.fills ?? []);
    setTotalAmount(data.totalAmount ?? 0);
    setTotalLitres(data.totalLitres ?? 0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = photoRef.current?.files?.[0];
    if (!file) {
      setError("Photo is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const here = await readHere();
      if (!here) throw new Error("Location is required");
      const photo = await jpegPhoto(file);
      const body = new FormData();
      body.set("vehicleId", liveTrip?.vehicleId || vehicleId);
      if (liveTrip?.id) body.set("tripId", liveTrip.id);
      body.set("litres", litres);
      body.set("amount", amount);
      body.set("details", details);
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", photo, "invoice.jpg");
      const response = await fetch("/api/company/fuel", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      setLitres("");
      setAmount("");
      setDetails("");
      if (photoRef.current) photoRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Fuel"
      caption="Each fill stores the litres, the amount, a short note, and a photo of the invoice, with the place and time. The total is the sum of those amounts."
    >
      <Alert message={error} onClose={() => setError(null)} />
      <p className="mt-4 text-2xl font-extrabold text-ink">{money(totalAmount)}</p>
      <p className="text-sm text-ink">{totalLitres.toLocaleString("en-IN")} litres in total.</p>
      {mine ? (
        <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4 border-2 border-ink bg-paper p-4 sm:grid-cols-2">
          <p className="text-sm text-ink sm:col-span-2">
            {liveTrip?.vehicleRegistration
              ? `This fill is saved on ${liveTrip.vehicleRegistration}.`
              : "Choose the truck, then photograph the invoice where you filled it."}
          </p>
          {liveTrip?.vehicleId ? null : (
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
              Truck
              <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={fieldClass} required>
                <option value="">Choose</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Litres
            <input value={litres} onChange={(event) => setLitres(event.target.value)} inputMode="decimal" required className={fieldClass} />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Amount (₹)
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required className={fieldClass} />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted sm:col-span-2">
            Details
            <input
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              required
              maxLength={200}
              placeholder="Pump name or fuel type"
              className={fieldClass}
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted sm:col-span-2">
            Invoice photo
            <input ref={photoRef} type="file" accept="image/*" capture="environment" required className={fieldClass} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? "Saving…" : "Save fuel fill"}
            </button>
          </div>
        </form>
      ) : null}
      <ul className="mt-4 space-y-3">
        {fills.map((fill) => (
          <li key={fill.id} className="grid gap-3 border-2 border-ink bg-paper p-3 sm:grid-cols-[8rem_1fr]">
            <a href={`/api/company/media/fuel/${fill.id}`} target="_blank" rel="noreferrer" className="relative block h-32">
              <Image
                src={`/api/company/media/fuel/${fill.id}`}
                alt={`Fuel invoice for ${fill.registrationNumber ?? "truck"}`}
                fill
                unoptimized
                className="object-cover"
              />
            </a>
            <div className="text-sm text-ink">
              <p className="font-extrabold">
                {money(fill.amount)} · {fill.litres.toLocaleString("en-IN")} L
              </p>
              <p className="mt-1">
                {fill.registrationNumber ?? "Truck"}
                {fill.driverName ? ` · ${fill.driverName}` : ""}
                {fill.details ? ` · ${fill.details}` : ""}
              </p>
              <p className="mt-1 text-muted">{when(fill.filledAt)}</p>
              {fill.latitude != null && fill.longitude != null ? (
                <p className="text-muted">{fill.latitude.toFixed(5)}, {fill.longitude.toFixed(5)}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {fills.length === 0 ? <p className="mt-3 text-sm text-ink">No fuel fills yet.</p> : null}
    </SectionCard>
  );
}
