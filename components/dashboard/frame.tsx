"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";

export async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; secret?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not save");
  return data;
}

export function useFleetSave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(url: string, method: string, body?: unknown) {
    setSaving(true);
    setError(null);
    try {
      const data = await send(url, method, body);
      router.refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { error, setError, saving, submit };
}

export function SectionCard({
  title,
  caption,
  action,
  children,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-2 border-ink bg-paper-subtle p-5 shadow-[var(--shadow-brutal)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          {caption ? <p className="mt-1 max-w-xl text-sm text-muted">{caption}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Alert({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return <Modal message={message} onConfirm={onClose} onCancel={onClose} />;
}

export function Actions({
  saving,
  label,
  onCancel,
}: {
  saving: boolean;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 sm:col-span-2">
      <button type="submit" className={primaryBtn} disabled={saving}>
        {saving ? "Saving…" : label}
      </button>
      <button type="button" className={quietBtn} disabled={saving} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={labelClass}>
      {label}
      {children}
    </label>
  );
}

export function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="font-bold text-accent underline decoration-2 underline-offset-2"
      disabled={disabled}
      onClick={onClick}
    >
      Remove
    </button>
  );
}
