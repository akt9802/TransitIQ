"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoView } from "@/components/PhotoView";
import { Alert } from "@/components/dashboard/frame";
import { CameraFrame } from "@/components/dashboard/CameraFrame";
import { readHere } from "@/components/dashboard/photo";
import { fieldClass, labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import { ISSUE_KINDS, ISSUE_LABEL, type IssueKind } from "@/lib/company/road-kinds";
import type { OwnReport, PendingIssue, RoadIssue } from "@/lib/company/roads";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function place(spot: { latitude: number; longitude: number }) {
  return `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`;
}

function who(spot: { driverName?: string; firstDriver?: string; fleetName: string; vehicleRegistration: string | null }) {
  const driver = spot.driverName ?? spot.firstDriver ?? "Driver";
  const truck = spot.vehicleRegistration ?? "No truck on a trip";
  return `${driver} · ${spot.fleetName} · ${truck}`;
}

function IssueMap({ spots }: { spots: RoadIssue[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || spots.length === 0) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: spots[0].latitude, lng: spots[0].longitude },
          zoom: 12,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        for (const spot of spots) {
          const position = { lat: spot.latitude, lng: spot.longitude };
          bounds.extend(position);
          new google.maps.Marker({ map, position, title: who(spot) });
        }
        if (spots.length > 1) map.fitBounds(bounds);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [spots]);

  if (spots.length === 0) return null;
  return <div ref={containerRef} className="h-72 w-full border-2 border-ink bg-paper" />;
}

export default function RoadSection({ mine, linked }: { mine: boolean; linked: boolean }) {
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<IssueKind | "">("");
  const [queueKind, setQueueKind] = useState<IssueKind>("pothole");
  const [monthPoints, setMonthPoints] = useState(0);
  const [earlierPoints, setEarlierPoints] = useState(0);
  const [reports, setReports] = useState<OwnReport[]>([]);
  const [queue, setQueue] = useState<PendingIssue[]>([]);
  const [issues, setIssues] = useState<RoadIssue[]>([]);

  const waiting = useMemo(() => queue.filter((spot) => spot.kind === queueKind), [queue, queueKind]);
  const open = useMemo(() => issues.filter((spot) => spot.kind === queueKind), [issues, queueKind]);

  async function load() {
    const response = await fetch("/api/company/potholes");
    const body = (await response.json()) as {
      error?: string;
      monthPoints?: number;
      earlierPoints?: number;
      reports?: OwnReport[];
      queue?: PendingIssue[];
      issues?: RoadIssue[];
    };
    if (!response.ok) {
      setError(body.error ?? "Road reports could not be loaded");
      return;
    }
    setMonthPoints(body.monthPoints ?? 0);
    setEarlierPoints(body.earlierPoints ?? 0);
    setReports(body.reports ?? []);
    setQueue(body.queue ?? []);
    setIssues(body.issues ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(id: string, action: "approve" | "reject" | "fix" | "team") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/company/potholes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string; outcome?: string };
      if (!response.ok) throw new Error(payload.error ?? "The issue could not be updated");
      setNotice(payload.outcome === "duplicate"
        ? "That place is already confirmed, so this photo was rejected."
        : payload.outcome === "approved_late"
          ? "Confirmed. The driver gets 12 points. This accident is older than 3 days, so other drivers are not warned."
          : payload.outcome === "approved"
            ? "Confirmed. The driver gets 12 points."
            : payload.outcome === "team"
              ? "Team sent. Drivers are still warned until it is marked fixed."
              : payload.outcome === "fixed"
                ? "Marked fixed. Drivers are no longer warned."
                : "Rejected. It stays off the map.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The issue could not be updated");
    } finally {
      setBusy(false);
    }
  }

  async function openCamera() {
    setError(null);
    setNotice(null);
    if (!kind) {
      setError("Choose the kind of issue");
      return;
    }
    setCamera(true);
  }

  async function takePhoto(file: File) {
    if (!kind) {
      setError("Choose the kind of issue");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const here = await readHere();
      if (!here) throw new Error("Location is required");
      const body = new FormData();
      body.set("kind", kind);
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", file, "issue.jpg");
      const response = await fetch("/api/company/potholes", { method: "POST", body });
      const payload = (await response.json()) as { error?: string; state?: string };
      if (!response.ok) throw new Error(payload.error ?? "The issue could not be sent");
      setCamera(false);
      setNotice(payload.state === "repeat"
        ? "3 points. This issue is already confirmed."
        : "Sent. The 12 points come after the road manager confirms the photo.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The issue could not be sent");
    } finally {
      setBusy(false);
    }
  }

  if (mine) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Points</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Choose what is on the road, then open the camera. The phone’s place is saved with the photo. You get 12 points only after the road manager confirms it. The same issue already confirmed within 50 metres is 3 points. One point is one rupee this month.
          </p>
        </div>
        <p className="text-2xl font-extrabold text-ink">{monthPoints} points · ₹{monthPoints}</p>
        {earlierPoints > 0 ? <p className="text-sm text-muted">Earlier months: {earlierPoints} points</p> : null}
        <Alert message={error} onClose={() => setError(null)} />
        {notice ? <p className="text-sm font-extrabold text-ink">{notice}</p> : null}
        {linked ? (
          <div className="max-w-md space-y-3">
            <label className={labelClass}>
              What is it
              <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as IssueKind | "")}>
                <option value="">Choose</option>
                {ISSUE_KINDS.map((key) => (
                  <option key={key} value={key}>{ISSUE_LABEL[key]}</option>
                ))}
              </select>
            </label>
            {camera ? (
              <CameraFrame busy={busy} onClose={() => setCamera(false)} onShot={(file) => void takePhoto(file)} />
            ) : (
              <button type="button" className={primaryBtn} onClick={() => void openCamera()}>Open camera</button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink">This sign-in is not linked to a driver.</p>
        )}
        <ul className="divide-y divide-ink/15">
          {reports.map((report) => (
            <li key={report.id} className="flex items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <PhotoView src={`/api/company/media/pothole/${report.id}`} alt={`${ISSUE_LABEL[report.kind]} photo`} />
              </span>
              <span className="text-sm text-ink">
                {ISSUE_LABEL[report.kind]} · {when(report.reportedAt)} · {report.status === "pending" ? "Waiting for confirmation" : `${report.points} points`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Road condition</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Each kind has its own queue. Confirm the photo, send a team, then mark it fixed. Drivers on that road are told to slow down until it is fixed. An accident leaves the map 3 days after the photo.
        </p>
      </div>
      <Alert message={error} onClose={() => setError(null)} />
      {notice ? <p className="text-sm font-extrabold text-ink">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {ISSUE_KINDS.map((key) => {
          const count = queue.filter((spot) => spot.kind === key).length + issues.filter((spot) => spot.kind === key).length;
          const selected = queueKind === key;
          return (
            <button
              key={key}
              type="button"
              className={selected ? primaryBtn : quietBtn}
              onClick={() => setQueueKind(key)}
            >
              {ISSUE_LABEL[key]}{count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>
      <h2 className="text-lg font-extrabold text-ink">Waiting</h2>
      {waiting.length === 0 ? <p className="text-sm text-muted">No photos waiting in this queue.</p> : (
        <ul className="divide-y divide-ink/15">
          {waiting.map((spot) => (
            <li key={spot.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <PhotoView src={`/api/company/media/pothole/${spot.photoId}`} alt={`${ISSUE_LABEL[spot.kind]} photo`} />
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {who(spot)} · {when(spot.reportedAt)} · {place(spot)}
                {spot.stale ? " · Older than 3 days. Drivers are not warned." : ""}
              </span>
              <button type="button" className={primaryBtn} disabled={busy} onClick={() => void decide(spot.id, "approve")}>Confirm</button>
              <button type="button" className={quietBtn} disabled={busy} onClick={() => void decide(spot.id, "reject")}>Reject</button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-extrabold text-ink">On the road</h2>
      <IssueMap spots={open} />
      {open.length === 0 ? <p className="text-sm text-muted">Nothing open in this queue.</p> : (
        <ul className="divide-y divide-ink/15">
          {open.map((spot) => (
            <li key={spot.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <PhotoView src={`/api/company/media/pothole/${spot.photoId}`} alt={`${ISSUE_LABEL[spot.kind]} photo`} />
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {who(spot)} · {when(spot.reportedAt)} · {place(spot)}
                {spot.drivers > 1 ? ` · ${spot.drivers} drivers` : ""}
                {spot.teamSentAt ? ` · Team sent ${when(spot.teamSentAt)}` : ""}
              </span>
              {spot.teamSentAt ? null : (
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => void decide(spot.id, "team")}>Send team</button>
              )}
              <button type="button" className={quietBtn} disabled={busy} onClick={() => void decide(spot.id, "fix")}>Fixed</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
