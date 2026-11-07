"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/dashboard/frame";
import { fieldClass } from "@/components/dashboard/styles";
import { loadGoogleMaps } from "@/components/maps/loadGoogleMaps";

export type PlaceValue = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

const INDIA = { lat: 22.5, lng: 79 };

export function PlaceSearch({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: PlaceValue;
  onChange: (place: PlaceValue) => void;
  onFocus: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const pickedRef = useRef(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });
        autocomplete.setBounds(
          new google.maps.LatLngBounds({ lat: 6.5, lng: 68 }, { lat: 35.5, lng: 97.5 })
        );
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          const location = place?.geometry?.location;
          if (!location) return;
          pickedRef.current = true;
          onChangeRef.current({
            address: place?.formatted_address || place?.name || inputRef.current?.value || "",
            latitude: location.lat(),
            longitude: location.lng(),
          });
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, []);

  return (
    <Field label={label}>
      <input
        ref={inputRef}
        required
        value={value.address}
        placeholder="Type a place"
        className={fieldClass}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        onChange={(event) => {
          if (pickedRef.current) {
            pickedRef.current = false;
            return;
          }
          onChange({ address: event.target.value, latitude: null, longitude: null });
        }}
      />
    </Field>
  );
}

export function TripMap({
  stops,
  activeIndex,
  onPick,
  onActive,
}: {
  stops: PlaceValue[];
  activeIndex: number;
  onPick: (index: number, place: PlaceValue) => void;
  onActive: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onPickRef = useRef(onPick);
  const onActiveRef = useRef(onActive);
  const activeRef = useRef(activeIndex);
  onPickRef.current = onPick;
  onActiveRef.current = onActive;
  activeRef.current = activeIndex;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "loading" : "error"
  );

  useEffect(() => {
    let cancelled = false;
    let map: google.maps.Map | null = null;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        map = new google.maps.Map(containerRef.current, {
          center: INDIA,
          zoom: 5,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        const geocoder = new google.maps.Geocoder();
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          const latLng = event.latLng;
          if (!latLng) return;
          const latitude = latLng.lat();
          const longitude = latLng.lng();
          const index = activeRef.current;
          geocoder.geocode({ location: latLng }, (results, code) => {
            const address =
              code === "OK" && results?.[0]?.formatted_address
                ? results[0].formatted_address
                : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            onPickRef.current(index, { address, latitude, longitude });
          });
        });
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      mapRef.current = null;
      if (map) google.maps.event.clearInstanceListeners(map);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const markers: google.maps.Marker[] = [];
    const path: google.maps.LatLngLiteral[] = [];
    stops.forEach((stop, index) => {
      if (stop.latitude == null || stop.longitude == null) return;
      const position = { lat: stop.latitude, lng: stop.longitude };
      path.push(position);
      const marker = new google.maps.Marker({
        position,
        map,
        draggable: index === activeIndex,
        title: stop.address,
        label: { text: String(index + 1), color: "#ffffff", fontWeight: "700" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: index === activeIndex ? "#2563eb" : "#171717",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: index === activeIndex ? 14 : 11,
        },
      });
      marker.addListener("click", () => onActiveRef.current(index));
      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        if (!position) return;
        const latitude = position.lat();
        const longitude = position.lng();
        new google.maps.Geocoder().geocode({ location: position }, (results, code) => {
          const address =
            code === "OK" && results?.[0]?.formatted_address
              ? results[0].formatted_address
              : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          onPickRef.current(index, { address, latitude, longitude });
        });
      });
      markers.push(marker);
    });
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    if (path.length === 1) {
      map.panTo(path[0]);
      map.setZoom(14);
    } else if (path.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    }
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      line.setMap(null);
    };
  }, [stops, activeIndex, status]);

  return (
    <div className="relative overflow-hidden rounded-md border-2 border-ink">
      <div ref={containerRef} className="h-72 w-full" />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper/80 text-sm text-muted">Loading map…</div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper px-4 text-center text-sm text-ink">
          The map could not load. Check that the Maps and Places APIs are enabled for this key.
        </div>
      ) : null}
    </div>
  );
}
