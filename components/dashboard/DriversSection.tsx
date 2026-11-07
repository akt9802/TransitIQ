"use client";

import { useState } from "react";
import PapersPanel from "@/components/dashboard/PapersPanel";
import { Actions, Alert, Field, RemoveButton, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, quietBtn } from "@/components/dashboard/styles";
import {
  DRIVER_DOC_KINDS,
  DRIVER_STATUSES,
  PAY_TYPES,
  type DriverRecord,
  type PaperRecord,
  type PersonRecord,
} from "@/lib/company/types";

type Draft = {
  id: string | null;
  fullName: string;
  phone: string;
  address: string;
  branchId: string;
  emergencyName: string;
  emergencyPhone: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiresOn: string;
  licenseEndorsements: string;
  payType: string;
  payRate: string;
  status: string;
  userId: string;
};

function blank(): Draft {
  return {
    id: null,
    fullName: "",
    phone: "",
    address: "",
    branchId: "",
    emergencyName: "",
    emergencyPhone: "",
    licenseNumber: "",
    licenseClass: "",
    licenseExpiresOn: "",
    licenseEndorsements: "",
    payType: "per_trip",
    payRate: "",
    status: "active",
    userId: "",
  };
}

function fromDriver(driver: DriverRecord): Draft {
  return {
    id: driver.id,
    fullName: driver.fullName,
    phone: driver.phone,
    address: driver.address ?? "",
    branchId: driver.branchId ?? "",
    emergencyName: driver.emergencyName ?? "",
    emergencyPhone: driver.emergencyPhone ?? "",
    licenseNumber: driver.licenseNumber ?? "",
    licenseClass: driver.licenseClass ?? "",
    licenseExpiresOn: driver.licenseExpiresOn ?? "",
    licenseEndorsements: driver.licenseEndorsements ?? "",
    payType: driver.payType,
    payRate: driver.payRate == null ? "" : String(driver.payRate),
    status: driver.status,
    userId: driver.userId ?? "",
  };
}

export default function DriversSection({
  drivers,
  people,
  papers,
  canWrite,
}: {
  drivers: DriverRecord[];
  people: PersonRecord[];
  papers: PaperRecord[];
  canWrite: boolean;
}) {
  const { error, setError, saving, submit } = useFleetSave();
  const [draft, setDraft] = useState<Draft | null>(null);
  const logins = people.filter((person) => person.roleKey === "driver");

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <SectionCard
      title="Drivers"
      caption="Everyone with the Driver role. Open one to add a licence, pay, and papers."
      action={
        canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft(blank()); }}>
            Add driver
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
            const ok = await submit(draft.id ? `/api/company/drivers/${draft.id}` : "/api/company/drivers", draft.id ? "PATCH" : "POST", draft);
            if (ok) setDraft(null);
          }}
        >
          <Field label="Name"><input required value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} className={fieldClass} /></Field>
          <Field label="Phone"><input required value={draft.phone} onChange={(e) => set("phone", e.target.value)} className={fieldClass} inputMode="tel" /></Field>
          <Field label="Sign-in">
            <select value={draft.userId} onChange={(e) => set("userId", e.target.value)} className={fieldClass}>
              <option value="">No login</option>
              {logins.map((person) => <option key={person.id} value={person.id}>{person.fullName?.trim() || person.email}</option>)}
            </select>
          </Field>
          <Field label="Address"><input value={draft.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} /></Field>
          <Field label="Status">
            <select value={draft.status} onChange={(e) => set("status", e.target.value)} className={fieldClass}>
              {DRIVER_STATUSES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Emergency contact"><input value={draft.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} className={fieldClass} /></Field>
          <Field label="Emergency phone"><input value={draft.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} className={fieldClass} inputMode="tel" /></Field>
          <Field label="License number"><input value={draft.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className={fieldClass} /></Field>
          <Field label="License class"><input value={draft.licenseClass} onChange={(e) => set("licenseClass", e.target.value)} className={fieldClass} /></Field>
          <Field label="License expiry"><input type="date" value={draft.licenseExpiresOn} onChange={(e) => set("licenseExpiresOn", e.target.value)} className={fieldClass} /></Field>
          <Field label="Endorsements"><input value={draft.licenseEndorsements} onChange={(e) => set("licenseEndorsements", e.target.value)} className={fieldClass} /></Field>
          <Field label="Pay">
            <select value={draft.payType} onChange={(e) => set("payType", e.target.value)} className={fieldClass}>
              {PAY_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Pay rate"><input value={draft.payRate} onChange={(e) => set("payRate", e.target.value)} className={fieldClass} inputMode="decimal" /></Field>
          <Actions saving={saving} label={draft.id ? "Save driver" : "Add driver"} onCancel={() => { setDraft(null); setError(null); }} />
        </form>
      ) : null}
      {draft?.id ? (
        <PapersPanel parentId={draft.id} rows={papers} kinds={DRIVER_DOC_KINDS} endpoint="/api/company/driver-documents" canWrite={canWrite} />
      ) : null}
      {drivers.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No drivers yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th className="py-2 pr-4 font-bold">Name</th>
                <th className="py-2 pr-4 font-bold">Phone</th>
                <th className="py-2 pr-4 font-bold">Status</th>
                <th className="py-2 font-bold">License</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4">{driver.fullName}</td>
                  <td className="py-3 pr-4">{driver.phone}</td>
                  <td className="py-3 pr-4">{DRIVER_STATUSES.find((item) => item.key === driver.status)?.label ?? driver.status}</td>
                  <td className="py-3">
                    <span className="mr-3">{driver.licenseExpiresOn ? `Expires ${driver.licenseExpiresOn}` : "Not added"}</span>
                    {canWrite ? (
                      <>
                        <button type="button" className="mr-3 font-bold text-accent underline decoration-2 underline-offset-2" onClick={() => { setError(null); setDraft(fromDriver(driver)); }}>Edit</button>
                        <RemoveButton disabled={saving} onClick={() => submit(`/api/company/drivers/${driver.id}`, "DELETE")} />
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
