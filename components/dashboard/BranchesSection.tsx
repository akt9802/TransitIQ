"use client";

import { useState } from "react";
import { Actions, Alert, Field, RemoveButton, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, quietBtn } from "@/components/dashboard/styles";
import type { BranchRecord } from "@/lib/company/types";

export default function BranchesSection({ branches, canWrite }: { branches: BranchRecord[]; canWrite: boolean }) {
  const { error, setError, saving, submit } = useFleetSave();
  const [draft, setDraft] = useState<{ id: string | null; name: string; address: string } | null>(null);

  return (
    <SectionCard
      title="Branches"
      caption="Yards and offices in this fleet. People, trucks, and drivers can belong to one."
      action={
        canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft({ id: null, name: "", address: "" }); }}>
            Add branch
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
            const ok = await submit(draft.id ? `/api/company/branches/${draft.id}` : "/api/company/branches", draft.id ? "PATCH" : "POST", draft);
            if (ok) setDraft(null);
          }}
        >
          <Field label="Name">
            <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Address">
            <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={fieldClass} />
          </Field>
          <Actions saving={saving} label={draft.id ? "Save branch" : "Add branch"} onCancel={() => { setDraft(null); setError(null); }} />
        </form>
      ) : null}
      {branches.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No branches yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th className="py-2 pr-4 font-bold">Name</th>
                <th className="py-2 font-bold">Address</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4">{branch.name}</td>
                  <td className="py-3">
                    <span className="mr-3">{branch.address?.trim() || "Not added"}</span>
                    {canWrite ? (
                      <>
                        <button type="button" className="mr-3 font-bold text-accent underline decoration-2 underline-offset-2" onClick={() => { setError(null); setDraft({ id: branch.id, name: branch.name, address: branch.address ?? "" }); }}>
                          Edit
                        </button>
                        <RemoveButton disabled={saving} onClick={() => submit(`/api/company/branches/${branch.id}`, "DELETE")} />
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
