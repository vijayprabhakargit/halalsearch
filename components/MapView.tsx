"use client";

import { useEffect, useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/mapStyle";
import { markerTone, TONE_COLORS, TONE_LABELS, type VerdictState } from "@/lib/status";
import type { Place } from "@/lib/types";

interface MapViewProps {
  center: { lat: number; lng: number };
  places: Place[];
  states: Record<string, VerdictState>;
  selectedId: string | null;
  userPosition: { lat: number; lng: number } | null;
  onSelect: (place: Place) => void;
  onBoundsChanged: (center: { lat: number; lng: number }) => void;
}

export default function MapView({
  center,
  places,
  states,
  selectedId,
  userPosition,
  onSelect,
  onBoundsChanged,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const lastFlyTo = useRef<string>("");

  useEffect(() => {
    const key = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
    if (lastFlyTo.current === key) return;
    lastFlyTo.current = key;
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: 15, duration: 800 });
  }, [center.lat, center.lng]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom: 14,
      }}
      mapStyle={MAP_STYLE_URL}
      attributionControl={{ compact: true }}
      onMoveEnd={(event) =>
        onBoundsChanged({
          lat: event.viewState.latitude,
          lng: event.viewState.longitude,
        })
      }
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="bottom-right" />

      {userPosition && (
        <Marker
          longitude={userPosition.lng}
          latitude={userPosition.lat}
          anchor="center"
        >
          <span
            className="block h-4 w-4 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: "#2563eb" }}
            aria-label="Your location"
          />
        </Marker>
      )}

      {places.map((place) => {
        const tone = markerTone(place, states[place.placeId]);
        const selected = place.placeId === selectedId;
        return (
          <Marker
            key={place.placeId}
            longitude={place.lng}
            latitude={place.lat}
            anchor="bottom"
          >
            <button
              type="button"
              title={`${place.name} — ${TONE_LABELS[tone]}`}
              onClick={() => onSelect(place)}
              className="flex flex-col items-center focus:outline-none"
            >
              <span
                className={`block rounded-full border-2 border-white shadow-md transition-transform ${
                  tone === "loading" ? "animate-pulse" : ""
                } ${selected ? "h-5 w-5" : "h-4 w-4"}`}
                style={{ backgroundColor: TONE_COLORS[tone] }}
              />
              <span
                className="mt-[2px] h-2 w-[2px]"
                style={{ backgroundColor: TONE_COLORS[tone] }}
              />
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
