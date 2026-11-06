"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "google-maps-script-transitiq";

const PATH: google.maps.LatLngLiteral[] = [
  { lat: 19.281, lng: 73.048 },
  { lat: 18.989, lng: 73.118 },
  { lat: 18.755, lng: 73.406 },
  { lat: 18.52, lng: 73.857 },
];

const STOP_LABELS = ["Navi Mumbai", "Lonavala ghat", "Pune approach", "Pune"];

/**
 * Mumbai–Pune corridor preview. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.
 */
export default function CorridorMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const keyMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const el = containerRef.current;
    if (!apiKey || !el) {
      if (!apiKey) setStatus("error");
      return;
    }

    let cancelled = false;
    let dispose: (() => void) | undefined;

    function buildMap(): () => void {
      if (!window.google?.maps || !containerRef.current) {
        setStatus("error");
        return () => {};
      }

      /* Default Google basemap — no custom styles (keeps terrain / colour as shipped). */
      const map = new google.maps.Map(containerRef.current, {
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      const bounds = new google.maps.LatLngBounds();
      PATH.forEach((p) => bounds.extend(p));

      const pad = { top: 36, right: 36, bottom: 36, left: 36 };
      map.fitBounds(bounds, pad);

      const idleListener = google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (z != null && z > 10) map.setZoom(10);
      });

      const polyline = new google.maps.Polyline({
        path: PATH,
        strokeColor: "#2563eb",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });

      const markers: google.maps.Marker[] = [];

      PATH.forEach((position, i) => {
        markers.push(
          new google.maps.Marker({
            position,
            map,
            title: STOP_LABELS[i] ?? `Stop ${i + 1}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: 9,
            },
            label: {
              text: String(i + 1),
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
            },
          })
        );
      });

      function refit() {
        google.maps.event.trigger(map, "resize");
        map.fitBounds(bounds, pad);
        const z = map.getZoom();
        if (z != null && z > 10) map.setZoom(10);
      }

      const node = containerRef.current;
      const ro =
        typeof ResizeObserver !== "undefined" && node
          ? new ResizeObserver(refit)
          : null;
      ro?.observe(node);
      window.addEventListener("resize", refit);

      if (!cancelled) setStatus("ready");

      return () => {
        google.maps.event.removeListener(idleListener);
        polyline.setMap(null);
        markers.forEach((m) => m.setMap(null));
        ro?.disconnect();
        window.removeEventListener("resize", refit);
      };
    }

    function runWhenReady() {
      if (cancelled) return;
      dispose?.();
      dispose = buildMap();
    }

    setStatus("loading");

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps) {
        runWhenReady();
      } else {
        const onLoad = () => runWhenReady();
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", () => setStatus("error"), { once: true });
        return () => {
          cancelled = true;
          existing.removeEventListener("load", onLoad);
          dispose?.();
        };
      }
      return () => {
        cancelled = true;
        dispose?.();
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => runWhenReady();
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
      script.onerror = null;
      dispose?.();
    };
  }, []);

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-paper-muted/50">
      <div
        ref={containerRef}
        className="h-[min(58vh,480px)] w-full min-h-[260px] md:h-[min(62vh,560px)] md:min-h-[380px]"
      />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/75 text-sm font-semibold text-muted backdrop-blur-[2px]">
          Loading map…
        </div>
      )}

      {(status === "error" || keyMissing) && (
        <div className="border-t-2 border-ink bg-paper-subtle px-4 py-3 text-sm text-muted">
          {keyMissing ? (
            <>
              Add{" "}
              <code className="rounded bg-paper px-1 py-0.5 text-xs text-ink">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              </code>{" "}
              to <code className="text-xs">.env.local</code> (see{" "}
              <code className="text-xs">.env.example</code>).
            </>
          ) : (
            <>
              Map could not load. Confirm the key has the Maps JavaScript API
              enabled.
            </>
          )}
        </div>
      )}
    </div>
  );
}
