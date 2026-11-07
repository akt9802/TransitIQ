"use client";

import { useState } from "react";
import { Actions, Alert, Field, RemoveButton, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, quietBtn } from "@/components/dashboard/styles";
import type { VendorRecord } from "@/lib/company/types";

type Draft = { id: string | null; name: string; phone: string; gstin: string };

export default function VendorsSection({ vendors, canWrite }: { vendors: VendorRecord[]; canWrite: boolean }) {
  const { error, setError, saving, submit } = useFleetSave();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <SectionCard
      title="Vendors"
      caption="Owners of trucks attached to this fleet. They are not the company that pays for TransitIQ."
      action={
        canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft({ id: null, name: "", phone: "", gstin: "" }); }}>
            Add vendor
          </button>
        ) : null
      }
    >
      <Alert message={error} onClose={() => setError(null)} />
      {draft ? (
        <form
          className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await submit(draft.id ? `/api/company/vendors/${draft.id}` : "/api/company/vendors", draft.id ? "PATCH" : "POST", draft);
            if (ok) setDraft(null);
          }}
        >
          <Field label="Name">
            <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Phone">
            <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={fieldClass} inputMode="tel" />
          </Field>
          <Field label="GSTIN">
            <input value={draft.gstin} onChange={(e) => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })} className={fieldClass} maxLength={15} />
          </Field>
          <Actions saving={saving} label={draft.id ? "Save vendor" : "Add vendor"} onCancel={() => { setDraft(null); setError(null); }} />
        </form>
      ) : null}
      {vendors.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No vendors yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th className="py-2 pr-4 font-bold">Name</th>
                <th className="py-2 pr-4 font-bold">Phone</th>
                <th className="py-2 font-bold">GSTIN</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4">{vendor.name}</td>
                  <td className="py-3 pr-4">{vendor.phone?.trim() || "Not added"}</td>
                  <td className="py-3">
                    <span className="mr-3">{vendor.gstin?.trim() || "Not added"}</span>
                    {canWrite ? (
                      <>
                        <button type="button" className="mr-3 font-bold text-accent underline decoration-2 underline-offset-2" onClick={() => { setError(null); setDraft({ id: vendor.id, name: vendor.name, phone: vendor.phone ?? "", gstin: vendor.gstin ?? "" }); }}>
                          Edit
                        </button>
                        <RemoveButton disabled={saving} onClick={() => submit(`/api/company/vendors/${vendor.id}`, "DELETE")} />
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
