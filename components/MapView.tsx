"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import PlacePin, { cuisineCategory } from "./PlacePin";
import { markerTone, TONE_LABELS, type VerdictState } from "@/lib/status";
import type { CommunitySummary } from "@/lib/community";
import type { Place } from "@/lib/types";
import {
  DEFAULT_CENTER,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
} from "@/lib/mapConfig";

interface MapViewProps {
  center: { lat: number; lng: number };
  places: Place[];
  states: Record<string, VerdictState>;
  communitySummaries: Record<string, CommunitySummary>;
  selectedId: string | null;
  userPosition: { lat: number; lng: number } | null;
  locateSignal: number;
  onSelect: (place: Place) => void;
  onBoundsChanged: (center: { lat: number; lng: number }) => void;
}

interface ControllerProps {
  center: { lat: number; lng: number };
  locateSignal: number;
  userPosition: { lat: number; lng: number } | null;
  onBoundsChanged: (center: { lat: number; lng: number }) => void;
}

/** Imperative map behaviour: recenter, locate, and report the viewport center. */
function MapController({
  center,
  locateSignal,
  userPosition,
  onBoundsChanged,
}: ControllerProps) {
  const map = useMap();
  const lastCenter = useRef("");
  const userRef = useRef(userPosition);
  const { lat, lng } = center;

  useEffect(() => {
    userRef.current = userPosition;
  }, [userPosition]);

  useEffect(() => {
    if (!map) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (lastCenter.current === key) return;
    lastCenter.current = key;
    map.panTo({ lat, lng });
    map.setZoom(15);
  }, [map, lat, lng]);

  useEffect(() => {
    if (!map || !locateSignal) return;
    const pos = userRef.current;
    if (pos) {
      map.panTo(pos);
      map.setZoom(16);
    }
  }, [map, locateSignal]);

  // Report the settled viewport center (used for "Search this area").
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onBoundsChanged({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [map, onBoundsChanged]);

  return null;
}

export default function MapView({
  center,
  places,
  states,
  communitySummaries,
  selectedId,
  userPosition,
  locateSignal,
  onSelect,
  onBoundsChanged,
}: MapViewProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={15}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <MapController
          center={center}
          locateSignal={locateSignal}
          userPosition={userPosition}
          onBoundsChanged={onBoundsChanged}
        />

        {userPosition && (
          <AdvancedMarker
            position={userPosition}
            zIndex={500}
            title="Your location"
          >
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute h-8 w-8 rounded-full bg-blue-500/20" />
              <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-500/30" />
              <span className="relative h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow-md" />
            </span>
          </AdvancedMarker>
        )}

        {places.map((place) => {
          const tone = markerTone(
            place,
            states[place.placeId],
            communitySummaries[place.placeId]?.verdict ?? null,
          );
          const selected = place.placeId === selectedId;
          return (
            <AdvancedMarker
              key={place.placeId}
              position={{ lat: place.lat, lng: place.lng }}
              zIndex={selected ? 1000 : 1}
              title={`${place.name} — ${TONE_LABELS[tone]}`}
              onClick={() => onSelect(place)}
            >
              <button
                type="button"
                className="group flex cursor-pointer flex-col items-center p-1 focus:outline-none"
                aria-label={`${place.name}, ${TONE_LABELS[tone]}`}
              >
                <PlacePin
                  tone={tone}
                  category={cuisineCategory(place.cuisine)}
                  selected={selected}
                />
              </button>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}
