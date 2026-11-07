"use client";

import { useState } from "react";
import { Alert, Field, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import type { ApiKeyRecord } from "@/lib/company/types";

export default function ApiKeysSection({ keys, canWrite }: { keys: ApiKeyRecord[]; canWrite: boolean }) {
  const { error, saving, submit } = useFleetSave();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <SectionCard title="API keys" caption="Keys for your own tools. The secret is shown once, and only a hash is stored.">
      <Alert message={error} />
      {secret ? (
        <p className="mt-4 break-all rounded-md border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm text-ink">
          Copy this key now. It will not be shown again.
          <span className="mt-1 block font-bold">{secret}</span>
        </p>
      ) : null}
      {canWrite ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = await submit("/api/company/api-keys", "POST", { name });
            if (data?.secret) {
              setSecret(data.secret);
              setName("");
            }
          }}
        >
          <Field label="Name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </Field>
          <button type="submit" className={primaryBtn} disabled={saving}>{saving ? "Saving…" : "Create key"}</button>
        </form>
      ) : null}
      {keys.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No keys yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-muted">
                <th className="py-2 pr-4 font-bold">Name</th>
                <th className="py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-ink/15">
                  <td className="py-3 pr-4">{key.name}</td>
                  <td className="py-3">
                    <span className="mr-3">{key.revokedAt ? "Revoked" : "Active"}</span>
                    {canWrite && !key.revokedAt ? (
                      <button type="button" className={quietBtn} disabled={saving} onClick={() => submit(`/api/company/api-keys/${key.id}`, "DELETE")}>
                        Revoke
                      </button>
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
