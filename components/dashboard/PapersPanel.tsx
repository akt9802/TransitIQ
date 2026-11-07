"use client";

import { useState } from "react";
import { Field, RemoveButton, useFleetSave } from "@/components/dashboard/frame";
import { fieldClass, quietBtn } from "@/components/dashboard/styles";
import type { PaperRecord } from "@/lib/company/types";

type Kind = { key: string; label: string };

export default function PapersPanel({
  parentId,
  rows,
  kinds,
  endpoint,
  canWrite,
  showIssued,
}: {
  parentId: string;
  rows: PaperRecord[];
  kinds: readonly Kind[];
  endpoint: string;
  canWrite: boolean;
  showIssued?: boolean;
}) {
  const { error, saving, submit } = useFleetSave();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(kinds[0]?.key ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const mine = rows.filter((row) => row.parentId === parentId);

  return (
    <div className="mt-6 border-t border-ink/15 pt-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">Papers</h2>
        {canWrite && !open ? (
          <button type="button" className={quietBtn} onClick={() => setOpen(true)}>
            Add paper
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-ink">{error}</p> : null}
      {open ? (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await submit(endpoint, "POST", {
              parentId,
              kind,
              documentNumber,
              fileKey,
              issuedOn,
              expiresOn,
            });
            if (ok) {
              setOpen(false);
              setDocumentNumber("");
              setFileKey("");
              setIssuedOn("");
              setExpiresOn("");
            }
          }}
        >
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldClass}>
              {kinds.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Number">
            <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className={fieldClass} />
          </Field>
          {showIssued ? (
            <Field label="Issued on">
              <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={fieldClass} />
            </Field>
          ) : null}
          <Field label="Expires on">
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="File reference">
            <input value={fileKey} onChange={(e) => setFileKey(e.target.value)} className={fieldClass} />
          </Field>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className={quietBtn} disabled={saving}>Save paper</button>
            <button type="button" className={quietBtn} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {mine.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No papers yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/15 text-sm">
          {mine.map((paper) => (
            <li key={paper.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {kinds.find((item) => item.key === paper.kind)?.label ?? paper.kind}
                {paper.documentNumber ? ` · ${paper.documentNumber}` : ""}
                {paper.expiresOn ? ` · expires ${paper.expiresOn}` : ""}
              </span>
              {canWrite ? (
                <RemoveButton disabled={saving} onClick={() => submit(`${endpoint}/${paper.id}`, "DELETE")} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
