"use client";

import { useState } from "react";
import { Alert, Field, RemoveButton, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import {
  ATTENDANCE_KINDS,
  HOS_KINDS,
  type AttendanceRecord,
  type DriverRecord,
  type HosRecord,
  type PointRecord,
  type ShiftRecord,
  type VehicleRecord,
} from "@/lib/company/types";

type Tab = "shifts" | "attendance" | "hours" | "points";

function when(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function RosterSection({
  drivers,
  vehicles,
  shifts,
  attendance,
  hosLogs,
  pointEvents,
  canWrite,
}: {
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  shifts: ShiftRecord[];
  attendance: AttendanceRecord[];
  hosLogs: HosRecord[];
  pointEvents: PointRecord[];
  canWrite: boolean;
}) {
  const { error, setError, saving, submit } = useFleetSave();
  const [tab, setTab] = useState<Tab>("shifts");
  const driverName = (id: string) => drivers.find((driver) => driver.id === id)?.fullName ?? "Driver";
  const truckName = (id: string | null) => vehicles.find((vehicle) => vehicle.id === id)?.registrationNumber ?? "No truck";

  return (
    <SectionCard title="Roster" caption="Shifts, attendance, hours of service, and safety points.">
      <div className="mt-4 flex flex-wrap gap-2">
        {(["shifts", "attendance", "hours", "points"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={item === tab ? primaryBtn : quietBtn}
            onClick={() => { setTab(item); setError(null); }}
          >
            {item === "hours" ? "Hours" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <Alert message={error} />
      {tab === "shifts" ? (
        <LogForm
          canWrite={canWrite}
          saving={saving}
          onSubmit={(body) => submit("/api/company/shifts", "POST", body)}
          fields={
            <ShiftFields drivers={drivers} vehicles={vehicles} />
          }
        />
      ) : null}
      {tab === "attendance" ? (
        <LogForm canWrite={canWrite} saving={saving} onSubmit={(body) => submit("/api/company/attendance", "POST", body)} fields={<AttendanceFields drivers={drivers} />} />
      ) : null}
      {tab === "hours" ? (
        <LogForm canWrite={canWrite} saving={saving} onSubmit={(body) => submit("/api/company/hours", "POST", body)} fields={<HoursFields drivers={drivers} />} />
      ) : null}
      {tab === "points" ? (
        <LogForm canWrite={canWrite} saving={saving} onSubmit={(body) => submit("/api/company/points", "POST", body)} fields={<PointsFields drivers={drivers} />} />
      ) : null}

      <div className="mt-4 overflow-x-auto">
        {tab === "shifts" ? (
          <SimpleTable
            empty="No shifts yet."
            rows={shifts.map((shift) => ({
              id: shift.id,
              cells: [driverName(shift.driverId), truckName(shift.vehicleId), when(shift.startsAt), when(shift.endsAt)],
              remove: canWrite ? () => submit(`/api/company/shifts/${shift.id}`, "DELETE") : undefined,
            }))}
            heads={["Driver", "Truck", "Start", "End"]}
          />
        ) : null}
        {tab === "attendance" ? (
          <SimpleTable
            empty="No attendance yet."
            heads={["Driver", "Day", "Kind", "Note"]}
            rows={attendance.map((row) => ({
              id: row.id,
              cells: [driverName(row.driverId), row.day, ATTENDANCE_KINDS.find((item) => item.key === row.kind)?.label ?? row.kind, row.note ?? ""],
              remove: canWrite ? () => submit(`/api/company/attendance/${row.id}`, "DELETE") : undefined,
            }))}
          />
        ) : null}
        {tab === "hours" ? (
          <SimpleTable
            empty="No hours yet."
            heads={["Driver", "Kind", "Start", "End"]}
            rows={hosLogs.map((row) => ({
              id: row.id,
              cells: [driverName(row.driverId), HOS_KINDS.find((item) => item.key === row.kind)?.label ?? row.kind, when(row.startedAt), row.endedAt ? when(row.endedAt) : "Open"],
              remove: canWrite ? () => submit(`/api/company/hours/${row.id}`, "DELETE") : undefined,
            }))}
          />
        ) : null}
        {tab === "points" ? (
          <SimpleTable
            empty="No points yet."
            heads={["Driver", "Points", "Reason"]}
            rows={pointEvents.map((row) => ({
              id: row.id,
              cells: [driverName(row.driverId), String(row.points), row.reason],
              remove: canWrite ? () => submit(`/api/company/points/${row.id}`, "DELETE") : undefined,
            }))}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function LogForm({
  canWrite,
  saving,
  fields,
  onSubmit,
}: {
  canWrite: boolean;
  saving: boolean;
  fields: React.ReactNode;
  onSubmit: (body: FormData) => Promise<unknown>;
}) {
  if (!canWrite) return null;
  return (
    <form
      className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const body = Object.fromEntries(new FormData(form).entries());
        const ok = await onSubmit(body as unknown as FormData);
        if (ok) form.reset();
      }}
    >
      {fields}
      <div className="sm:col-span-2">
        <button type="submit" className={primaryBtn} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
      </div>
    </form>
  );
}

function DriverSelect({ drivers }: { drivers: DriverRecord[] }) {
  return (
    <Field label="Driver">
      <select name="driverId" required className={fieldClass} defaultValue="">
        <option value="" disabled>Choose</option>
        {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}
      </select>
    </Field>
  );
}

function ShiftFields({ drivers, vehicles }: { drivers: DriverRecord[]; vehicles: VehicleRecord[] }) {
  return (
    <>
      <DriverSelect drivers={drivers} />
      <Field label="Truck">
        <select name="vehicleId" className={fieldClass} defaultValue="">
          <option value="">No truck</option>
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}
        </select>
      </Field>
      <Field label="Start"><input required type="datetime-local" name="startsAt" className={fieldClass} /></Field>
      <Field label="End"><input required type="datetime-local" name="endsAt" className={fieldClass} /></Field>
    </>
  );
}

function AttendanceFields({ drivers }: { drivers: DriverRecord[] }) {
  return (
    <>
      <DriverSelect drivers={drivers} />
      <Field label="Day"><input required type="date" name="day" className={fieldClass} /></Field>
      <Field label="Kind">
        <select name="kind" className={fieldClass} defaultValue="present">
          {ATTENDANCE_KINDS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Note"><input name="note" className={fieldClass} /></Field>
    </>
  );
}

function HoursFields({ drivers }: { drivers: DriverRecord[] }) {
  return (
    <>
      <DriverSelect drivers={drivers} />
      <Field label="Kind">
        <select name="kind" className={fieldClass} defaultValue="driving">
          {HOS_KINDS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Start"><input required type="datetime-local" name="startedAt" className={fieldClass} /></Field>
      <Field label="End"><input type="datetime-local" name="endedAt" className={fieldClass} /></Field>
    </>
  );
}

function PointsFields({ drivers }: { drivers: DriverRecord[] }) {
  return (
    <>
      <DriverSelect drivers={drivers} />
      <Field label="Points"><input required name="points" inputMode="numeric" className={fieldClass} /></Field>
      <Field label="Reason"><input required name="reason" className={fieldClass} /></Field>
      <Field label="Source">
        <select name="sourceType" className={fieldClass} defaultValue="">
          <option value="">None</option>
          <option value="trip">Trip</option>
          <option value="incident_report">Hazard report</option>
        </select>
      </Field>
    </>
  );
}

function SimpleTable({
  heads,
  rows,
  empty,
}: {
  heads: string[];
  empty: string;
  rows: { id: string; cells: string[]; remove?: () => void }[];
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b-2 border-ink text-muted">
          {heads.map((head) => <th key={head} className="py-2 pr-4 font-bold">{head}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-ink/15">
            {row.cells.map((cell, index) => (
              <td key={index} className="py-3 pr-4">
                {cell}
                {index === row.cells.length - 1 && row.remove ? <span className="ml-3"><RemoveButton onClick={row.remove} /></span> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
