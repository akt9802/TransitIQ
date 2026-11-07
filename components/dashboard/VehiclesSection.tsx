"use client";

import { cloneElement, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/dashboard/frame";
import { indiaToday, vehiclePaperLine } from "@/lib/company/paper-rules";
import {
  TRUCK_TYPES,
  VEHICLE_DOC_KINDS,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
  type PaperRecord,
  type VehicleRecord,
} from "@/lib/company/types";
import { fieldClass, invalidFieldClass, labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";

type Props = {
  vehicles: VehicleRecord[];
  vehicleLimit: number;
  canWrite: boolean;
  papers: PaperRecord[];
};

type PaperDraft = { documentNumber: string; expiresOn: string };

const EXPIRY_REQUIRED = new Set(["insurance", "permit", "fitness", "pollution"]);

function blankPapers(): Record<string, PaperDraft> {
  return Object.fromEntries(VEHICLE_DOC_KINDS.map((item) => [item.key, { documentNumber: "", expiresOn: "" }]));
}

function papersFor(vehicleId: string, rows: PaperRecord[]): Record<string, PaperDraft> {
  const draft = blankPapers();
  for (const row of rows) {
    if (row.parentId !== vehicleId || !draft[row.kind]) continue;
    const current = draft[row.kind];
    if (row.expiresOn && (!current.expiresOn || row.expiresOn > current.expiresOn)) {
      current.expiresOn = row.expiresOn;
      if (row.documentNumber) current.documentNumber = row.documentNumber;
    } else if (!current.documentNumber && row.documentNumber) {
      current.documentNumber = row.documentNumber;
    }
  }
  return draft;
}

type Draft = {
  id: string | null;
  papers: Record<string, PaperDraft>;
  registrationNumber: string;
  truckType: string;
  ownership: string;
  status: string;
  make: string;
  model: string;
  year: string;
  loadCapacityKg: string;
  axleCount: string;
  chassisNumber: string;
  engineNumber: string;
  lengthM: string;
  widthM: string;
  heightM: string;
  odometerKm: string;
  tankCapacityL: string;
  contractStart: string;
  contractEnd: string;
  branchId: string;
  vendorId: string;
};

function blank(): Draft {
  return {
    id: null,
    papers: blankPapers(),
    registrationNumber: "",
    truckType: "open",
    ownership: "owned",
    status: "active",
    make: "",
    model: "",
    year: "",
    loadCapacityKg: "",
    axleCount: "",
    chassisNumber: "",
    engineNumber: "",
    lengthM: "",
    widthM: "",
    heightM: "",
    odometerKm: "",
    tankCapacityL: "",
    contractStart: "",
    contractEnd: "",
    branchId: "",
    vendorId: "",
  };
}

function fromVehicle(vehicle: VehicleRecord, papers: PaperRecord[]): Draft {
  const text = (value: string | number | null) => (value == null ? "" : String(value));
  return {
    id: vehicle.id,
    papers: papersFor(vehicle.id, papers),
    registrationNumber: vehicle.registrationNumber,
    truckType: vehicle.truckType,
    ownership: vehicle.ownership,
    status: VEHICLE_STATUSES.some((item) => item.key === vehicle.status) ? vehicle.status : "active",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    year: text(vehicle.year),
    loadCapacityKg: text(vehicle.loadCapacityKg),
    axleCount: text(vehicle.axleCount),
    chassisNumber: vehicle.chassisNumber ?? "",
    engineNumber: vehicle.engineNumber ?? "",
    lengthM: text(vehicle.lengthM),
    widthM: text(vehicle.widthM),
    heightM: text(vehicle.heightM),
    odometerKm: text(vehicle.odometerKm),
    tankCapacityL: text(vehicle.tankCapacityL),
    contractStart: vehicle.contractStart ?? "",
    contractEnd: vehicle.contractEnd ?? "",
    branchId: vehicle.branchId ?? "",
    vendorId: vehicle.vendorId ?? "",
  };
}

function labelFor(list: readonly { key: string; label: string }[], key: string): string {
  return list.find((item) => item.key === key)?.label ?? key;
}

const ERROR_FIELDS: [string, keyof Draft][] = [
  ["Registration number", "registrationNumber"],
  ["This registration", "registrationNumber"],
  ["Truck type", "truckType"],
  ["Ownership", "ownership"],
  ["Branch", "branchId"],
  ["Vendor", "vendorId"],
  ["Choose a vendor", "vendorId"],
  ["Choose a branch", "branchId"],
  ["Status", "status"],
  ["Make", "make"],
  ["Model", "model"],
  ["Year", "year"],
  ["Load capacity", "loadCapacityKg"],
  ["Axle count", "axleCount"],
  ["Odometer", "odometerKm"],
  ["Chassis number", "chassisNumber"],
  ["Engine number", "engineNumber"],
  ["Length", "lengthM"],
  ["Width", "widthM"],
  ["Height", "heightM"],
  ["Tank capacity", "tankCapacityL"],
  ["Contract start", "contractStart"],
  ["Contract end", "contractEnd"],
];

function fieldForError(message: string): keyof Draft | null {
  return ERROR_FIELDS.find(([prefix]) => message.startsWith(prefix))?.[1] ?? null;
}

export default function VehiclesSection({ vehicles, vehicleLimit, canWrite, papers }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const atLimit = vehicles.length >= vehicleLimit;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError((current) => (current && fieldForError(current) === key ? null : current));
  }

  function setPaper(kind: string, key: "documentNumber" | "expiresOn", value: string) {
    setDraft((current) => {
      if (!current) return current;
      const paper = current.papers[kind] ?? { documentNumber: "", expiresOn: "" };
      return { ...current, papers: { ...current.papers, [kind]: { ...paper, [key]: value } } };
    });
  }

  const errorField = error ? fieldForError(error) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { papers, ...vehicle } = draft;
      const res = await fetch(draft.id ? `/api/company/vehicles/${draft.id}` : "/api/company/vehicles", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...vehicle,
          papers: VEHICLE_DOC_KINDS.map((item) => ({
            kind: item.key,
            documentNumber: papers[item.key]?.documentNumber ?? "",
            expiresOn: papers[item.key]?.expiresOn ?? "",
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-2 border-ink bg-paper-subtle p-5 shadow-[var(--shadow-brutal)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Vehicles</h1>
          <p className="mt-1 text-sm text-muted">
            {vehicles.length} of {vehicleLimit} on this plan.
          </p>
        </div>
        {canWrite && !draft ? (
          <button
            type="button"
            className={quietBtn}
            disabled={atLimit}
            onClick={() => {
              setError(atLimit ? `This plan includes ${vehicleLimit} trucks.` : null);
              if (!atLimit) setDraft(blank());
            }}
          >
            Add truck
          </button>
        ) : null}
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {draft ? (
        <form onSubmit={save} className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2">
          <Field label="Registration number" field="registrationNumber" errorField={errorField}>
            <input
              required
              value={draft.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value.toUpperCase())}
              className={fieldClass}
            />
          </Field>
          <Field label="Truck type" field="truckType" errorField={errorField}>
            <select value={draft.truckType} onChange={(e) => set("truckType", e.target.value)} className={fieldClass}>
              {TRUCK_TYPES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ownership" field="ownership" errorField={errorField}>
            <select value={draft.ownership} onChange={(e) => set("ownership", e.target.value)} className={fieldClass}>
              {VEHICLE_OWNERSHIP.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" field="status" errorField={errorField}>
            <select value={draft.status} onChange={(e) => set("status", e.target.value)} className={fieldClass}>
              {VEHICLE_STATUSES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Make" field="make" errorField={errorField}>
            <input value={draft.make} onChange={(e) => set("make", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Model" field="model" errorField={errorField}>
            <input value={draft.model} onChange={(e) => set("model", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Year" field="year" errorField={errorField}>
            <input value={draft.year} onChange={(e) => set("year", e.target.value)} className={fieldClass} inputMode="numeric" />
          </Field>
          <Field label="Load capacity (kg)" field="loadCapacityKg" errorField={errorField}>
            <input
              value={draft.loadCapacityKg}
              onChange={(e) => set("loadCapacityKg", e.target.value)}
              className={fieldClass}
              inputMode="decimal"
            />
          </Field>
          <Field label="Axles" field="axleCount" errorField={errorField}>
            <input value={draft.axleCount} onChange={(e) => set("axleCount", e.target.value)} className={fieldClass} inputMode="numeric" />
          </Field>
          <Field label="Odometer (km)" field="odometerKm" errorField={errorField}>
            <input value={draft.odometerKm} onChange={(e) => set("odometerKm", e.target.value)} className={fieldClass} inputMode="decimal" />
          </Field>
          <Field label="Chassis number" field="chassisNumber" errorField={errorField}>
            <input value={draft.chassisNumber} onChange={(e) => set("chassisNumber", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Engine number" field="engineNumber" errorField={errorField}>
            <input value={draft.engineNumber} onChange={(e) => set("engineNumber", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Length (m)" field="lengthM" errorField={errorField}>
            <input value={draft.lengthM} onChange={(e) => set("lengthM", e.target.value)} className={fieldClass} inputMode="decimal" />
          </Field>
          <Field label="Width (m)" field="widthM" errorField={errorField}>
            <input value={draft.widthM} onChange={(e) => set("widthM", e.target.value)} className={fieldClass} inputMode="decimal" />
          </Field>
          <Field label="Height (m)" field="heightM" errorField={errorField}>
            <input value={draft.heightM} onChange={(e) => set("heightM", e.target.value)} className={fieldClass} inputMode="decimal" />
          </Field>
          <Field label="Tank capacity (litres)" field="tankCapacityL" errorField={errorField}>
            <input
              value={draft.tankCapacityL}
              onChange={(e) => set("tankCapacityL", e.target.value)}
              className={fieldClass}
              inputMode="decimal"
            />
          </Field>
          {draft.ownership !== "owned" ? (
            <>
              <Field label="Contract start" field="contractStart" errorField={errorField}>
                <input type="date" value={draft.contractStart} onChange={(e) => set("contractStart", e.target.value)} className={fieldClass} />
              </Field>
              <Field label="Contract end" field="contractEnd" errorField={errorField}>
                <input type="date" value={draft.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} className={fieldClass} />
              </Field>
            </>
          ) : null}
          <div className="sm:col-span-2 border-t border-ink/15 pt-4">
            <h2 className="text-lg font-extrabold text-ink">Papers</h2>
            <p className="mt-1 text-sm text-muted">
              Insurance, permit, fitness, and pollution need an expiry before an active truck can take a trip. RC needs a number. Road tax can stay empty. Change the date here when a paper is renewed.
            </p>
            <div className="mt-4 grid gap-4">
              {VEHICLE_DOC_KINDS.map((item) => {
                const paper = draft.papers[item.key] ?? { documentNumber: "", expiresOn: "" };
                const expiryRequired = EXPIRY_REQUIRED.has(item.key);
                return (
                  <div key={item.key} className="grid gap-3 border-2 border-ink p-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      {item.label} number
                      <input
                        value={paper.documentNumber}
                        onChange={(e) => setPaper(item.key, "documentNumber", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      {expiryRequired ? `${item.label} expiry` : `${item.label} expiry, if it has one`}
                      <input
                        type="date"
                        value={paper.expiresOn}
                        onChange={(e) => setPaper(item.key, "expiresOn", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Save truck" : "Add truck"}
            </button>
            <button
              type="button"
              className={quietBtn}
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {vehicles.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No trucks yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Vehicles in this fleet</caption>
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th scope="col" className="py-2 pr-4 font-bold">Registration</th>
                <th scope="col" className="py-2 pr-4 font-bold">Type</th>
                <th scope="col" className="py-2 pr-4 font-bold">Truck</th>
                <th scope="col" className="py-2 pr-4 font-bold">Status</th>
                <th scope="col" className="py-2 pr-4 font-bold">Papers</th>
                <th scope="col" className="py-2 font-bold">Ownership</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4 text-ink">{vehicle.registrationNumber}</td>
                  <td className="py-3 pr-4 text-ink">{labelFor(TRUCK_TYPES, vehicle.truckType)}</td>
                  <td className="py-3 pr-4 text-ink">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Not added"}
                  </td>
                  <td className="py-3 pr-4 text-ink">{labelFor(VEHICLE_STATUSES, vehicle.status)}</td>
                  <td className="py-3 pr-4 text-ink">
                    {vehiclePaperLine(
                      papers.filter((paper) => paper.parentId === vehicle.id),
                      indiaToday()
                    )}
                  </td>
                  <td className="py-3 text-ink">
                    <span className="mr-3">{labelFor(VEHICLE_OWNERSHIP, vehicle.ownership)}</span>
                    {canWrite ? (
                      <button
                        type="button"
                        className="font-bold text-accent underline decoration-2 underline-offset-2"
                        onClick={() => {
                          setError(null);
                          setDraft(fromVehicle(vehicle, papers));
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  field,
  errorField,
  children,
}: {
  label: string;
  field: keyof Draft;
  errorField: keyof Draft | null;
  children: ReactElement<{ className?: string; "aria-invalid"?: boolean }>;
}) {
  const invalid = errorField === field;
  return (
    <label id={`vehicle-${field}`} className={labelClass}>
      {label}
      {cloneElement(children, {
        "aria-invalid": invalid || undefined,
        className: invalid ? invalidFieldClass : (children.props.className ?? fieldClass),
      })}
    </label>
  );
}
