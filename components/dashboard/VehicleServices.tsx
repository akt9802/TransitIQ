"use client";

import { useState } from "react";
import { Alert, useFleetSave } from "@/components/dashboard/frame";
import { useOpenRecord } from "@/components/dashboard/openRecord";
import { fieldClass, labelClass, quietBtn } from "@/components/dashboard/styles";
import { prettyDate } from "@/lib/company/paper-rules";
import { currentKm } from "@/lib/company/service-rules";
import type { ServiceView } from "@/lib/company/service-rules";

type Draft = {
  id: string | null;
  name: string;
  nextDueOn: string;
  nextDueKm: string;
  everyDays: string;
  everyKm: string;
};

const blank: Draft = { id: null, name: "", nextDueOn: "", nextDueKm: "", everyDays: "", everyKm: "" };

export default function VehicleServices({
  vehicleId,
  services,
  odometerKm,
  trackedKm,
  canWrite,
  focusId,
  focusOpen,
}: {
  vehicleId: string;
  services: ServiceView[];
  odometerKm: number | null;
  trackedKm: number;
  canWrite: boolean;
  focusId?: string;
  focusOpen?: string;
}) {
  const { error, setError, saving, submit } = useFleetSave();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reading, setReading] = useState("");
  const mine = services.filter((service) => service.vehicleId === vehicleId);
  useOpenRecord(focusId ? `${focusId}:${focusOpen ?? ""}` : undefined, () => {
    const service = mine.find((item) => item.id === focusId);
    if (!service || !canWrite) return;
    setError(null);
    setDraft({
      id: service.id,
      name: service.name,
      nextDueOn: service.nextDueOn ?? "",
      nextDueKm: service.nextDueKm == null ? "" : String(service.nextDueKm),
      everyDays: service.everyDays == null ? "" : String(service.everyDays),
      everyKm: service.everyKm == null ? "" : String(service.everyKm),
    });
  });
  const now = currentKm(odometerKm, trackedKm);

  function body(next: Draft) {
    return {
      vehicleId,
      name: next.name,
      nextDueOn: next.nextDueOn,
      nextDueKm: next.nextDueKm,
      everyDays: next.everyDays,
      everyKm: next.everyKm,
    };
  }

  return (
    <div id="vehicle-services" className="mt-6 scroll-mt-24 border-t border-ink/15 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">Service</h2>
        {canWrite && !draft ? (
          <button type="button" className={quietBtn} onClick={() => { setError(null); setDraft(blank); }}>
            Add service
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {now != null ? `Reading ${now.toLocaleString("en-IN")} km. ` : "Kilometres unknown until an odometer is saved. "}
        The next due is the first time. Repeat is used only after Done.
      </p>
      <Alert message={error} onClose={() => setError(null)} />
      {draft ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await submit(draft.id ? `/api/company/services/${draft.id}` : "/api/company/services", draft.id ? "PATCH" : "POST", body(draft));
            if (ok) setDraft(null);
          }}
        >
          <label className={labelClass}>Name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} /></label>
          <label className={labelClass}>Next due date<input type="date" value={draft.nextDueOn} onChange={(e) => setDraft({ ...draft, nextDueOn: e.target.value })} className={fieldClass} /></label>
          <label className={labelClass}>Next due at km<input value={draft.nextDueKm} onChange={(e) => setDraft({ ...draft, nextDueKm: e.target.value })} className={fieldClass} inputMode="decimal" /></label>
          <label className={labelClass}>Repeat after days<input value={draft.everyDays} onChange={(e) => setDraft({ ...draft, everyDays: e.target.value })} className={fieldClass} inputMode="numeric" /></label>
          <label className={labelClass}>Repeat after km<input value={draft.everyKm} onChange={(e) => setDraft({ ...draft, everyKm: e.target.value })} className={fieldClass} inputMode="decimal" /></label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="submit" className={quietBtn} disabled={saving}>{draft.id ? "Save" : "Add"}</button>
            <button type="button" className={quietBtn} onClick={() => { setDraft(null); setError(null); }}>Cancel</button>
          </div>
        </form>
      ) : null}
      <ul className="mt-3 divide-y divide-ink/15 text-sm">
        {mine.map((service) => {
          const needsReading = service.everyKm != null && now == null;
          return (
            <li key={service.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {service.name}
                {service.nextDueOn ? ` · ${prettyDate(service.nextDueOn)}` : ""}
                {service.nextDueKm != null ? ` · ${service.nextDueKm.toLocaleString("en-IN")} km` : ""}
                {!service.nextDueOn && service.nextDueKm == null ? " · no date" : ""}
                {service.lastDoneOn ? ` · last ${prettyDate(service.lastDoneOn)}` : ""}
              </span>
              {canWrite ? (
                <span className="flex flex-wrap items-center gap-2">
                  {needsReading ? (
                    <input
                      value={reading}
                      onChange={(e) => setReading(e.target.value)}
                      placeholder="Odometer"
                      aria-label={`Odometer for ${service.name}`}
                      className={`${fieldClass} mt-0 w-28`}
                      inputMode="decimal"
                    />
                  ) : null}
                  <button
                    type="button"
                    className="font-bold text-accent underline decoration-2 underline-offset-2"
                    disabled={saving}
                    onClick={() => submit(`/api/company/services/${service.id}/done`, "POST", { odometerKm: needsReading ? reading : "" })}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="font-bold text-ink underline decoration-2 underline-offset-2"
                    onClick={() => {
                      setError(null);
                      setDraft({
                        id: service.id,
                        name: service.name,
                        nextDueOn: service.nextDueOn ?? "",
                        nextDueKm: service.nextDueKm == null ? "" : String(service.nextDueKm),
                        everyDays: service.everyDays == null ? "" : String(service.everyDays),
                        everyKm: service.everyKm == null ? "" : String(service.everyKm),
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="text-muted underline" disabled={saving} onClick={() => submit(`/api/company/services/${service.id}`, "DELETE")}>
                    Remove
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
