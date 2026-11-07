"use client";

import { useState } from "react";
import { Actions, Alert, Field, RemoveButton, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, quietBtn } from "@/components/dashboard/styles";
import { DEVICE_KINDS, type DeviceRecord, type DriverRecord, type VehicleRecord } from "@/lib/company/types";

type Draft = { id: string | null; kind: string; externalId: string; vehicleId: string; driverId: string };

export default function DevicesSection({
  devices,
  vehicles,
  drivers,
  canWrite,
}: {
  devices: DeviceRecord[];
  vehicles: VehicleRecord[];
  drivers: DriverRecord[];
  canWrite: boolean;
}) {
  const { error, setError, saving, submit } = useFleetSave();
  const [draft, setDraft] = useState<Draft | null>(null);
  const name = (id: string | null, rows: { id: string; label: string }[]) => rows.find((row) => row.id === id)?.label ?? "Not linked";
  const trucks = vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.registrationNumber }));
  const people = drivers.map((driver) => ({ id: driver.id, label: driver.fullName }));

  return (
    <SectionCard
      title="Trackers"
      caption="A GPS box on the truck, or the driver's phone."
      action={
        canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft({ id: null, kind: "gps", externalId: "", vehicleId: "", driverId: "" }); }}>
            Add tracker
          </button>
        ) : null
      }
    >
      <Alert message={error} />
      {draft ? (
        <form
          className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await submit(draft.id ? `/api/company/devices/${draft.id}` : "/api/company/devices", draft.id ? "PATCH" : "POST", draft);
            if (ok) setDraft(null);
          }}
        >
          <Field label="Type">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={fieldClass}>
              {DEVICE_KINDS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Tracker id">
            <input required value={draft.externalId} onChange={(e) => setDraft({ ...draft, externalId: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Truck">
            <select value={draft.vehicleId} onChange={(e) => setDraft({ ...draft, vehicleId: e.target.value })} className={fieldClass}>
              <option value="">Not linked</option>
              {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.label}</option>)}
            </select>
          </Field>
          <Field label="Driver">
            <select value={draft.driverId} onChange={(e) => setDraft({ ...draft, driverId: e.target.value })} className={fieldClass}>
              <option value="">Not linked</option>
              {people.map((driver) => <option key={driver.id} value={driver.id}>{driver.label}</option>)}
            </select>
          </Field>
          <Actions saving={saving} label={draft.id ? "Save tracker" : "Add tracker"} onCancel={() => { setDraft(null); setError(null); }} />
        </form>
      ) : null}
      {devices.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No trackers yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th className="py-2 pr-4 font-bold">Id</th>
                <th className="py-2 pr-4 font-bold">Type</th>
                <th className="py-2 pr-4 font-bold">Truck</th>
                <th className="py-2 font-bold">Driver</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4">{device.externalId}</td>
                  <td className="py-3 pr-4">{DEVICE_KINDS.find((item) => item.key === device.kind)?.label ?? device.kind}</td>
                  <td className="py-3 pr-4">{name(device.vehicleId, trucks)}</td>
                  <td className="py-3">
                    <span className="mr-3">{name(device.driverId, people)}</span>
                    {canWrite ? (
                      <>
                        <button type="button" className="mr-3 font-bold text-accent underline decoration-2 underline-offset-2" onClick={() => { setError(null); setDraft({ id: device.id, kind: device.kind, externalId: device.externalId, vehicleId: device.vehicleId ?? "", driverId: device.driverId ?? "" }); }}>Edit</button>
                        <RemoveButton disabled={saving} onClick={() => submit(`/api/company/devices/${device.id}`, "DELETE")} />
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
