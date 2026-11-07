"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import type { TrackPoint } from "@/lib/company/tracking";

const COLORS = ["#2563eb", "#b45309", "#0f766e", "#be123c"];

export default function LiveTrail({
  trails,
}: {
  trails: { tripId: string; driverId: string; points: TrackPoint[] }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lines = trails.filter((trail) => trail.points.length > 0);
    if (!containerRef.current || lines.length === 0) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: {
            lat: lines[0].points[lines[0].points.length - 1].latitude,
            lng: lines[0].points[lines[0].points.length - 1].longitude,
          },
          zoom: 12,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        lines.forEach((trail, index) => {
          const path = trail.points.map((point) => ({ lat: point.latitude, lng: point.longitude }));
          path.forEach((point) => bounds.extend(point));
          new google.maps.Polyline({
            map,
            path,
            strokeColor: COLORS[index % COLORS.length],
            strokeOpacity: 0.95,
            strokeWeight: 5,
          });
          const last = path[path.length - 1];
          new google.maps.Marker({
            map,
            position: last,
            title: "Latest",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: COLORS[index % COLORS.length],
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        });
        if (lines.some((trail) => trail.points.length > 1) || lines.length > 1) map.fitBounds(bounds, 48);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [trails]);

  if (trails.every((trail) => trail.points.length === 0)) return null;
  return <div ref={containerRef} className="mt-4 h-80 w-full border-2 border-ink" />;
}
