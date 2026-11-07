"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";
import type { CustomerPoint } from "@/lib/company/tracking-link";

export default function CustomerMap({ points }: { points: CustomerPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const path = points.map((point) => ({ lat: point.latitude, lng: point.longitude }));
        const last = path[path.length - 1];
        const map = new google.maps.Map(containerRef.current, {
          center: last,
          zoom: 13,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        if (path.length > 1) {
          new google.maps.Polyline({ map, path, strokeColor: "#111111", strokeOpacity: 0.9, strokeWeight: 4 });
          map.fitBounds(bounds, 48);
        }
        new google.maps.Marker({ map, position: last, title: "Latest place" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [points]);

  if (points.length === 0) return null;
  return <div ref={containerRef} className="mt-3 h-80 w-full border-2 border-ink" />;
}
