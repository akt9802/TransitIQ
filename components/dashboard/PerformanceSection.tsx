"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, SectionCard } from "@/components/dashboard/frame";
import { primaryBtn, quietBtn } from "@/components/dashboard/styles";
import LiveTrail from "@/components/maps/LiveTrail";
import type { TrackingSnapshot } from "@/lib/company/tracking";

function money(value: number) {
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function clock(hours: number) {
  const total = Math.round(hours * 60);
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${whole} h ${minutes} min` : `${whole} h`;
}

function payLabel(payType: string) {
  if (payType === "per_km") return "Per km";
  if (payType === "salary") return "Monthly salary";
  return "Per trip";
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function PerformanceSection({ mine }: { mine: boolean }) {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/company/tracking");
    const data = (await response.json()) as TrackingSnapshot & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not load tracking");
      return;
    }
    setSnapshot(data);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    void load();
    return () => window.clearInterval(timer);
  }, [load]);

  async function sleep(action: "start" | "wake") {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/company/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const row = snapshot?.rows[0];
  const short = row ? Math.max(0, (snapshot?.sleepTargetHours ?? 8) - row.sleepHours) : 0;

  return (
    <SectionCard
      title={mine ? "My day" : "Performance"}
      caption={
        snapshot
          ? `A point is stored about every ${snapshot.gapMinutes} minutes and kept for ${snapshot.keptDays} days. Kilometres come from those points. Per km and per trip pay use that window. Salary is the monthly rate.`
          : "Loading the last 10 days."
      }
    >
      <Alert message={error} onClose={() => setError(null)} />
      {mine && row ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="border-2 border-ink bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Sleep today</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{clock(row.sleepHours)}</p>
            <p className="mt-1 text-sm text-ink">
              {short > 0
                ? `${snapshot?.sleepTargetHours ?? 8} hours is the target. Short by ${clock(short)}.`
                : `${snapshot?.sleepTargetHours ?? 8} hours reached.`}
            </p>
            {row.sleepingSince ? (
              <p className="mt-2 text-sm text-muted">Sleeping since {when(row.sleepingSince)}.</p>
            ) : null}
            <button
              type="button"
              className={`${row.sleepingSince ? quietBtn : primaryBtn} mt-4`}
              disabled={saving}
              onClick={() => sleep(row.sleepingSince ? "wake" : "start")}
            >
              {row.sleepingSince ? "Wake up" : "Start sleeping"}
            </button>
          </section>
          <section className="border-2 border-ink bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Last {snapshot?.keptDays} days</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{row.kilometres.toLocaleString("en-IN")} km</p>
            <p className="mt-1 text-sm text-ink">
              {row.tripsFinished} finished {row.tripsFinished === 1 ? "trip" : "trips"} · {payLabel(row.payType)}
            </p>
            <p className="mt-2 text-sm font-extrabold text-ink">
              {row.amount == null ? "Pay rate not set" : money(row.amount)}
              {row.payType === "salary" ? " monthly" : ""}
            </p>
          </section>
        </div>
      ) : null}
      {!mine && snapshot ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-xs font-bold uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Driver</th>
                <th className="py-2 pr-3">Km</th>
                <th className="py-2 pr-3">Trips</th>
                <th className="py-2 pr-3">Sleep today</th>
                <th className="py-2 pr-3">Pay</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((item) => (
                <tr key={item.driverId} className="border-b border-ink/15">
                  <td className="py-3 pr-3 font-extrabold text-ink">{item.driverName}</td>
                  <td className="py-3 pr-3">{item.kilometres.toLocaleString("en-IN")}</td>
                  <td className="py-3 pr-3">{item.tripsFinished}</td>
                  <td className="py-3 pr-3">
                    {clock(item.sleepHours)}
                    {item.sleepingSince ? " · sleeping" : ""}
                    {item.sleepHours < snapshot.sleepTargetHours ? ` · short ${clock(snapshot.sleepTargetHours - item.sleepHours)}` : ""}
                  </td>
                  <td className="py-3 pr-3">{payLabel(item.payType)}</td>
                  <td className="py-3">
                    {item.amount == null ? "Rate not set" : `${money(item.amount)}${item.payType === "salary" ? " / month" : ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshot.rows.length === 0 ? <p className="mt-3 text-sm text-ink">No active drivers.</p> : null}
        </div>
      ) : null}
      {snapshot && snapshot.trails.length > 0 ? (
        <>
          <p className="mt-4 text-sm text-muted">Latest stored positions on trips that are on the road.</p>
          <LiveTrail trails={snapshot.trails} />
        </>
      ) : snapshot ? (
        <p className="mt-4 text-sm text-ink">No locations stored yet. A point is saved about every 5 minutes while a trip is on the road.</p>
      ) : null}
    </SectionCard>
  );
}
