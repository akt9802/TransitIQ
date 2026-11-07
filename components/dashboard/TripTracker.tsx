"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

const GAP_MS = 5.5 * 60 * 1000;

export default function TripTracker({ tripId }: { tripId: string }) {
  const [off, setOff] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    function send(latitude: number, longitude: number) {
      void fetch("/api/company/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, latitude, longitude }),
      });
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
          send(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (!stopped) setOff(true);
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
      );
    }

    ping();
    timer = window.setInterval(ping, GAP_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [tripId]);

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
    </>
  );
}
