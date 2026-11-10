"use client";

import { useRef, useState } from "react";
import { PhotoView } from "@/components/PhotoView";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { jpegPhoto, readHere } from "@/components/dashboard/photo";
import { primaryBtn } from "@/components/dashboard/styles";
import type { TripProof } from "@/lib/company/types";

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 3;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function place(photo: TripProof) {
  return `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`;
}

export function ProofStrip({ proofs }: { proofs: TripProof[] }) {
  if (proofs.length === 0) return null;
  const groups = [
    { kind: "pickup" as const, label: "Pickup proof" },
    { kind: "delivery" as const, label: "Delivery proof" },
  ];
  return (
    <div className="mt-4 space-y-4">
      {groups.map((group) => {
        const photos = proofs.filter((photo) => photo.kind === group.kind);
        if (photos.length === 0) return null;
        return (
          <div key={group.kind}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{group.label}</p>
            <ul className="mt-2 grid gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <li key={photo.id} className="border-2 border-ink bg-paper">
                  <div className="relative block h-36">
                    <PhotoView
                      src={`/api/company/media/proof/${photo.id}`}
                      alt={`${group.label} at ${place(photo)}`}
                    />
                  </div>
                  <p className="px-2 py-2 text-xs text-ink">
                    {when(photo.takenAt)}
                    <span className="mt-1 block text-muted">{place(photo)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function ProofCapture({ tripId, kind, proofs }: { tripId: string; kind: "pickup" | "delivery"; proofs: TripProof[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = proofs.filter((photo) => photo.kind === kind);
  const title = kind === "pickup" ? "Pickup proof" : "Delivery proof";
  const hint =
    kind === "pickup"
      ? "After loading, take 2 or 3 photos of the truck at this pickup."
      : "At this delivery, take 2 or 3 photos so there is proof the truck reached here.";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const here = await readHere();
      if (!here) throw new Error("Location is required");
      const photo = await jpegPhoto(file);
      const body = new FormData();
      body.set("kind", kind);
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", photo, "proof.jpg");
      const response = await fetch(`/api/company/trips/${tripId}/proofs`, { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save the photo");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the photo");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 border-2 border-ink bg-paper-subtle p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-1 text-sm text-ink">{hint}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">
        {photos.length} of {MAX_PHOTOS}. {photos.length >= MIN_PHOTOS ? "Enough to continue." : `${MIN_PHOTOS} are required.`}
      </p>
      {photos.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="border-2 border-ink bg-paper">
              <span className="relative block h-28">
                <PhotoView
                  src={`/api/company/media/proof/${photo.id}`}
                  alt={`${title} taken ${when(photo.takenAt)}`}
                />
              </span>
              <p className="px-2 py-2 text-xs text-ink">
                {when(photo.takenAt)}
                <span className="mt-1 block text-muted">{place(photo)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length < MAX_PHOTOS ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <button type="button" className={`${primaryBtn} mt-3`} disabled={saving} onClick={() => inputRef.current?.click()}>
            {saving ? "Saving photo…" : "Take photo"}
          </button>
        </>
      ) : null}
      {error ? <Modal message={error} onConfirm={() => setError(null)} onCancel={() => setError(null)} /> : null}
    </div>
  );
}
