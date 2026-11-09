"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/dashboard/frame";
import { readHere } from "@/components/dashboard/photo";
import { primaryBtn, quietBtn } from "@/components/dashboard/styles";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import type { OwnReport, PendingPothole, PotholeSpot } from "@/lib/company/roads";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function place(spot: { latitude: number; longitude: number }) {
  return `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`;
}

function PotholeMap({ spots }: { spots: PotholeSpot[] }) {
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
          new google.maps.Marker({ map, position, title: spot.firstDriver });
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [monthPoints, setMonthPoints] = useState(0);
  const [earlierPoints, setEarlierPoints] = useState(0);
  const [reports, setReports] = useState<OwnReport[]>([]);
  const [queue, setQueue] = useState<PendingPothole[]>([]);
  const [potholes, setPotholes] = useState<PotholeSpot[]>([]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera(false);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function load() {
    const response = await fetch("/api/company/potholes");
    const body = (await response.json()) as {
      error?: string;
      monthPoints?: number;
      earlierPoints?: number;
      reports?: OwnReport[];
      queue?: PendingPothole[];
      potholes?: PotholeSpot[];
    };
    if (!response.ok) {
      setError(body.error ?? "Road reports could not be loaded");
      return;
    }
    setMonthPoints(body.monthPoints ?? 0);
    setEarlierPoints(body.earlierPoints ?? 0);
    setReports(body.reports ?? []);
    setQueue(body.queue ?? []);
    setPotholes(body.potholes ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(id: string, action: "approve" | "reject" | "fix") {
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
      if (!response.ok) throw new Error(payload.error ?? "The pothole could not be updated");
      setNotice(payload.outcome === "duplicate"
        ? "That place is already confirmed, so this photo was rejected."
        : payload.outcome === "approved"
          ? "Confirmed. The driver gets 12 points."
          : payload.outcome === "fixed"
            ? "Marked fixed. Drivers are no longer warned."
            : "Rejected. It stays off the map.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pothole could not be updated");
    } finally {
      setBusy(false);
    }
  }

  async function openCamera() {
    setError(null);
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no camera. Open the page on the phone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setCamera(true);
      window.setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }, 0);
    } catch {
      setError("Allow the camera, then try again.");
    }
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError("The camera is not ready.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const longest = Math.max(video.videoWidth, video.videoHeight);
      const scale = Math.min(1, 1600 / longest);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo is not valid");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const [file, here] = await Promise.all([
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72)),
        readHere(),
      ]);
      if (!file) throw new Error("Photo is not valid");
      if (!here) throw new Error("Location is required");
      const body = new FormData();
      body.set("latitude", String(here.latitude));
      body.set("longitude", String(here.longitude));
      body.set("photo", file, "pothole.jpg");
      const response = await fetch("/api/company/potholes", { method: "POST", body });
      const payload = (await response.json()) as { error?: string; state?: string };
      if (!response.ok) throw new Error(payload.error ?? "The pothole could not be sent");
      stopCamera();
      setNotice(payload.state === "repeat"
        ? "3 points. This pothole is already confirmed."
        : "Sent. The 12 points come after the road manager confirms the photo.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pothole could not be sent");
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
            Open the camera at the pothole. The phone’s place is saved with the photo. You get 12 points only after the road manager confirms it. A pothole already confirmed within 50 metres is 3 points. One point is one rupee this month.
          </p>
        </div>
        <p className="text-2xl font-extrabold text-ink">{monthPoints} points · ₹{monthPoints}</p>
        {earlierPoints > 0 ? <p className="text-sm text-muted">Earlier months: {earlierPoints} points</p> : null}
        <Alert message={error} onClose={() => setError(null)} />
        {notice ? <p className="text-sm font-extrabold text-ink">{notice}</p> : null}
        {linked ? (
          camera ? (
            <div className="max-w-md space-y-3">
              <video ref={videoRef} className="aspect-[3/4] w-full border-2 border-ink bg-ink object-cover" playsInline muted autoPlay />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => void takePhoto()}>
                  {busy ? "Sending" : "Take photo"}
                </button>
                <button type="button" className={quietBtn} disabled={busy} onClick={stopCamera}>Close</button>
              </div>
            </div>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => void openCamera()}>Open camera</button>
          )
        ) : (
          <p className="text-sm text-ink">This sign-in is not linked to a driver.</p>
        )}
        <ul className="divide-y divide-ink/15">
          {reports.map((report) => (
            <li key={report.id} className="flex items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <Image alt="" className="object-cover" fill sizes="56px" src={`/api/company/media/pothole/${report.id}`} unoptimized />
              </span>
              <span className="text-sm text-ink">
                {when(report.reportedAt)} · {report.status === "pending" ? "Waiting for confirmation" : `${report.points} points`}
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
          Confirm a photo before it goes on the map. Mark it fixed when the hole is gone. Until then, a driver on that road is told to slow down.
        </p>
      </div>
      <Alert message={error} onClose={() => setError(null)} />
      {notice ? <p className="text-sm font-extrabold text-ink">{notice}</p> : null}
      <h2 className="text-lg font-extrabold text-ink">Waiting</h2>
      {queue.length === 0 ? <p className="text-sm text-muted">No photos waiting.</p> : (
        <ul className="divide-y divide-ink/15">
          {queue.map((spot) => (
            <li key={spot.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <Image alt="" className="object-cover" fill sizes="56px" src={`/api/company/media/pothole/${spot.photoId}`} unoptimized />
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">{spot.driverName} · {when(spot.reportedAt)} · {place(spot)}</span>
              <button type="button" className={primaryBtn} disabled={busy} onClick={() => void decide(spot.id, "approve")}>Confirm</button>
              <button type="button" className={quietBtn} disabled={busy} onClick={() => void decide(spot.id, "reject")}>Reject</button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-extrabold text-ink">On the road</h2>
      <PotholeMap spots={potholes} />
      {potholes.length === 0 ? <p className="text-sm text-muted">No open potholes.</p> : (
        <ul className="divide-y divide-ink/15">
          {potholes.map((spot) => (
            <li key={spot.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden border-2 border-ink">
                <Image alt="" className="object-cover" fill sizes="56px" src={`/api/company/media/pothole/${spot.photoId}`} unoptimized />
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {spot.firstDriver} · {when(spot.reportedAt)} · {place(spot)}
                {spot.drivers > 1 ? ` · ${spot.drivers} drivers` : ""}
              </span>
              <button type="button" className={quietBtn} disabled={busy} onClick={() => void decide(spot.id, "fix")}>Fixed</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
