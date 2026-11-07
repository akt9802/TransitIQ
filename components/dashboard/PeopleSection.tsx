"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNABLE_ROLES, type PersonRecord } from "@/lib/company/types";
import { Alert } from "@/components/dashboard/frame";
import { fieldClass, labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";

type Props = {
  people: PersonRecord[];
  canWrite: boolean;
};

type Draft = {
  id: string | null;
  fullName: string;
  email: string;
  phone: string;
  roleKey: string;
  branchId: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  fullName: "",
  email: "",
  phone: "",
  roleKey: "driver",
  branchId: "",
});

export default function PeopleSection({ people, canWrite }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function edit(person: PersonRecord) {
    setError(null);
    setDraft({
      id: person.id,
      fullName: person.fullName ?? "",
      email: person.email,
      phone: person.phone ?? "",
      roleKey: person.roleKey ?? "driver",
      branchId: person.branchId ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(draft.id ? `/api/company/people/${draft.id}` : "/api/company/people", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: draft.fullName,
          email: draft.email,
          phone: draft.phone,
          roleKey: draft.roleKey,
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
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">People</h1>
          <p className="mt-1 text-sm text-muted">Everyone who can sign in to this fleet.</p>
        </div>
        {canWrite && !draft ? (
          <button
            type="button"
            className={quietBtn}
            onClick={() => {
              setError(null);
              setDraft(emptyDraft());
            }}
          >
            Add person
          </button>
        ) : null}
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {draft ? (
        <form onSubmit={save} className="mt-4 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2">
          <label className={labelClass}>
            Name
            <input
              required
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Email
            <input
              required
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={fieldClass}
              readOnly={Boolean(draft.id && people.find((person) => person.id === draft.id)?.hasLogin)}
            />
          </label>
          <label className={labelClass}>
            Phone
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className={fieldClass}
              inputMode="tel"
            />
          </label>
          <label className={labelClass}>
            Role
            <select
              value={draft.roleKey}
              onChange={(e) => setDraft({ ...draft, roleKey: e.target.value })}
              className={fieldClass}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Save person" : "Add person"}
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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">People in this fleet</caption>
          <thead>
            <tr className="border-b-2 border-ink text-muted">
              <th scope="col" className="py-2 pr-4 font-bold">Name</th>
              <th scope="col" className="py-2 pr-4 font-bold">Email</th>
              <th scope="col" className="py-2 pr-4 font-bold">Phone</th>
              <th scope="col" className="py-2 pr-4 font-bold">Role</th>
              <th scope="col" className="py-2 font-bold">Sign in</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-b border-ink/15">
                <td className="py-3 pr-4 text-ink">{person.fullName?.trim() || "Not added"}</td>
                <td className="py-3 pr-4 text-ink">{person.email}</td>
                <td className="py-3 pr-4 text-ink">{person.phone?.trim() || "Not added"}</td>
                <td className="py-3 pr-4 text-ink">{person.roleName ?? "Member"}</td>
                <td className="py-3 text-ink">
                  <span className="mr-3">{person.hasLogin ? "Ready" : "Not set up"}</span>
                  {canWrite && person.roleKey !== "owner" ? (
                    <button type="button" className="font-bold text-accent underline decoration-2 underline-offset-2" onClick={() => edit(person)}>
                      Edit
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
