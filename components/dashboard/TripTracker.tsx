"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/Modal";
import { quietBtn } from "@/components/dashboard/styles";
import { restMessage } from "@/lib/company/motion";
import type { TrackingSnapshot } from "@/lib/company/tracking";

const GAP_MS = 5.5 * 60 * 1000;

type Duty = {
  restNotice: string | null;
  dutyKey: string;
  moving: boolean;
  moveCount: number;
  speedKmh: number | null;
  averageSpeedKmh: number | null;
};

function restAlertPermission() {
  return typeof Notification === "undefined" ? "missing" : Notification.permission;
}

function restAlertServer() {
  return "missing" as const;
}

function subscribeRestAlerts() {
  return () => {};
}

function notice(body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("Please stop and rest", { body });
  } catch {
    /* The in-app notice still shows. */
  }
}

export default function TripTracker({ tripId }: { tripId: string }) {
  const [off, setOff] = useState(false);
  const [asked, setAsked] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [duty, setDuty] = useState<Duty | null>(null);
  const [restModal, setRestModal] = useState<string | null>(null);
  const [chosenAlert, setChosenAlert] = useState<NotificationPermission | null>(null);
  const liveAlert = useSyncExternalStore(subscribeRestAlerts, restAlertPermission, restAlertServer);
  const alerts = chosenAlert ?? liveAlert;
  const warned = useRef(new Set<string>());
  const warnedHoles = useRef(new Set<string>());
  const driveErrorRef = useRef<string | null>(null);
  const [ahead, setAhead] = useState<string | null>(null);
  const [driveModal, setDriveModal] = useState(false);

  const apply = useCallback((next: Duty) => {
    setDuty(next);
    if (!next.restNotice) {
      setRestModal(null);
      return;
    }
    const key = `transitiq-rest:${next.dutyKey}`;
    if (warned.current.has(key)) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {
      seen = false;
    }
    if (seen) {
      warned.current.add(key);
      return;
    }
    warned.current.add(key);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* The modal still shows for this visit. */
    }
    setRestModal(next.restNotice);
    notice(next.restNotice);
  }, []);

  useEffect(() => {
    let stopped = false;

    async function loadSnapshot() {
      const response = await fetch("/api/company/tracking");
      const data = (await response.json().catch(() => null)) as TrackingSnapshot | null;
      const row = data?.rows[0];
      if (!response.ok || !row?.onTrip || stopped) return;
      apply({
        restNotice: row.restDue ? restMessage(row.drivingHours) : null,
        dutyKey: row.dutyKey,
        moving: row.liveMoving,
        moveCount: row.liveMoveCount,
        speedKmh: row.liveSpeedKmh,
        averageSpeedKmh: row.liveAverageSpeedKmh,
      });
    }

    async function send(latitude: number, longitude: number) {
      const response = await fetch("/api/company/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, latitude, longitude }),
      });
      const data = (await response.json().catch(() => null)) as (Duty & { error?: string }) | null;
      if (!response.ok) {
        const message = data?.error ?? "";
        if (!stopped && /sleep|still moving/i.test(message) && driveErrorRef.current !== message) {
          driveErrorRef.current = message;
          setDriveError(message);
          setDriveModal(true);
        }
        return;
      }
      if (stopped || !data) return;
      driveErrorRef.current = null;
      setDriveError(null);
      setDriveModal(false);
      apply(data);
    }

    function ping() {
      if (stopped) return;
      if (!navigator.geolocation) {
        setOff(true);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (stopped) return;
          setOff(false);
          void send(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (!stopped) setOff(true);
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
      );
    }

    async function look(latitude: number, longitude: number) {
      const response = await fetch(`/api/company/potholes/ahead?latitude=${latitude}&longitude=${longitude}&tripId=${tripId}`);
      const data = (await response.json().catch(() => null)) as { text?: string | null; potholeId?: string | null } | null;
      if (stopped || !response.ok || !data) return;
      setAhead(data.text ?? null);
      if (!data.text || !data.potholeId || warnedHoles.current.has(data.potholeId)) return;
      warnedHoles.current.add(data.potholeId);
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      try {
        new Notification("Slow down", { body: data.text });
      } catch {
        /* The line on the trip still shows. */
      }
    }

    function watchRoad() {
      if (stopped || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!stopped) void look(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (!stopped) setAhead(null);
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 }
      );
    }

    void loadSnapshot();
    const refresh = window.setInterval(() => void loadSnapshot(), 60_000);
    ping();
    watchRoad();
    const timer = window.setInterval(ping, GAP_MS);
    const roadTimer = window.setInterval(watchRoad, 20_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(roadTimer);
      window.clearInterval(refresh);
    };
  }, [apply, tripId]);

  const average =
    duty?.averageSpeedKmh == null ? "Average speed is not in yet." : `Average speed on this trip is ${duty.averageSpeedKmh} km/h.`;
  const moves =
    duty == null
      ? null
      : duty.moving
        ? `Moving${duty.speedKmh != null ? ` at ${duty.speedKmh} km/h` : ""}. ${average} This trip has started moving ${duty.moveCount} ${duty.moveCount === 1 ? "time" : "times"}.`
        : duty.moveCount === 0
          ? "Tracking is on. The truck counts as moving once it covers some ground on the way to the stop."
          : `Stopped. ${average} This trip has started moving ${duty.moveCount} ${duty.moveCount === 1 ? "time" : "times"}.`;

  return (
    <>
      {driveModal && driveError ? (
        <Modal message={driveError} onConfirm={() => setDriveModal(false)} onCancel={() => setDriveModal(false)} />
      ) : null}
      {driveError ? (
        <p className="mt-4 border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm font-extrabold text-ink">{driveError}</p>
      ) : null}
      {ahead ? (
        <p className="mt-4 border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm font-extrabold text-ink">{ahead}</p>
      ) : null}
      {off ? (
        <p className="mt-4 border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm font-extrabold text-ink">
          Location is off. Turn it on so this trip can be tracked.
        </p>
      ) : null}
      {off && !asked ? (
        <Modal
          message="Location is off. Turn it on so this trip can be tracked."
          onConfirm={() => setAsked(true)}
          onCancel={() => setAsked(true)}
        />
      ) : null}
      {duty?.restNotice ? (
        <p className="mt-4 border-2 border-ink bg-accent-warm/40 px-3 py-2 text-sm font-extrabold text-ink">
          {duty.restNotice}
        </p>
      ) : moves ? (
        <p className="mt-4 border-2 border-ink bg-paper px-3 py-2 text-sm text-ink">{moves}</p>
      ) : null}
      {alerts === "default" ? (
        <button
          type="button"
          className={`${quietBtn} mt-3`}
          onClick={() => {
            void Notification.requestPermission().then((permission) => {
              setChosenAlert(permission);
              if (permission === "granted" && duty?.restNotice) notice(duty.restNotice);
            });
          }}
        >
          Allow rest alerts
        </button>
      ) : null}
      {restModal ? (
        <Modal message={restModal} onConfirm={() => setRestModal(null)} onCancel={() => setRestModal(null)} />
      ) : null}
    </>
  );
}
