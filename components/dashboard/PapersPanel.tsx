"use client";

import { useState } from "react";
import { Alert, Field, RemoveButton, useFleetSave } from "@/components/dashboard/frame";
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
  const { error, setError, saving, submit } = useFleetSave();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState(kinds[0]?.key ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const mine = rows.filter((row) => row.parentId === parentId);

  function close() {
    setOpen(false);
    setEditingId(null);
    setDocumentNumber("");
    setIssuedOn("");
    setExpiresOn("");
  }

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
      <Alert message={error} onClose={() => setError(null)} />
      {open ? (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await submit(editingId ? `${endpoint}/${editingId}` : endpoint, editingId ? "PATCH" : "POST", {
              parentId,
              kind,
              documentNumber,
              issuedOn,
              expiresOn,
            });
            if (ok) close();
          }}
        >
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldClass} disabled={Boolean(editingId)}>
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
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className={quietBtn} disabled={saving}>{editingId ? "Save date" : "Save paper"}</button>
            <button type="button" className={quietBtn} onClick={close}>Cancel</button>
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
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="font-bold text-accent underline decoration-2 underline-offset-2"
                    onClick={() => {
                      setError(null);
                      setEditingId(paper.id);
                      setKind(paper.kind);
                      setDocumentNumber(paper.documentNumber ?? "");
                      setIssuedOn(paper.issuedOn ?? "");
                      setExpiresOn(paper.expiresOn ?? "");
                      setOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <RemoveButton disabled={saving} onClick={() => submit(`${endpoint}/${paper.id}`, "DELETE")} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
