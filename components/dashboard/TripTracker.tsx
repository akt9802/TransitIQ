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
  const [duty, setDuty] = useState<Duty | null>(null);
  const [restModal, setRestModal] = useState<string | null>(null);
  const [chosenAlert, setChosenAlert] = useState<NotificationPermission | null>(null);
  const liveAlert = useSyncExternalStore(subscribeRestAlerts, restAlertPermission, restAlertServer);
  const alerts = chosenAlert ?? liveAlert;
  const warned = useRef(new Set<string>());

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
      });
    }

    async function send(latitude: number, longitude: number) {
      const response = await fetch("/api/company/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, latitude, longitude }),
      });
      const data = (await response.json().catch(() => null)) as Duty | null;
      if (!response.ok || !data || stopped) return;
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

    void loadSnapshot();
    const refresh = window.setInterval(() => void loadSnapshot(), 60_000);
    ping();
    const timer = window.setInterval(ping, GAP_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [apply, tripId]);

  const moves =
    duty == null
      ? null
      : duty.moving
        ? `Moving${duty.speedKmh != null ? ` at ${duty.speedKmh} km/h` : ""}. This trip has started moving ${duty.moveCount} ${duty.moveCount === 1 ? "time" : "times"}.`
        : duty.moveCount === 0
          ? "Tracking is on. The truck counts as moving once it covers some ground on the way to the stop."
          : `Stopped. This trip has started moving ${duty.moveCount} ${duty.moveCount === 1 ? "time" : "times"}.`;

  return (
    <>
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
