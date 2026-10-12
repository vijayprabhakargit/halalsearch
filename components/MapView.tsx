"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
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

interface LatLng {
  lat: number;
  lng: number;
}

export interface FocusTarget extends LatLng {
  nonce: number;
}

interface MapViewProps {
  places: Place[];
  states: Record<string, VerdictState>;
  communitySummaries: Record<string, CommunitySummary>;
  selectedId: string | null;
  userPosition: LatLng | null;
  locateSignal: number;
  focus: FocusTarget | null;
  searchOrigin: LatLng | null;
  onSelect: (place: Place) => void;
  onBoundsChanged: (center: LatLng) => void;
  onMapClick: (point: MapClickPoint) => void;
}

interface ControllerProps {
  focus: FocusTarget | null;
  locateSignal: number;
  userPosition: LatLng | null;
  onBoundsChanged: (center: LatLng) => void;
  onMapClick: (point: MapClickPoint) => void;
}

interface MapClickEvent {
  latLng?: { lat(): number; lng(): number } | null;
  /** Present when the user clicked a Google base-map POI (IconMouseEvent). */
  placeId?: string;
  stop?: () => void;
}

export interface MapClickPoint {
  lat: number;
  lng: number;
  /** Set when a Google POI was clicked. */
  placeId?: string;
}

/** Imperative map behaviour: fly on explicit actions, report the viewport center. */
function MapController({
  focus,
  locateSignal,
  userPosition,
  onBoundsChanged,
  onMapClick,
}: ControllerProps) {
  const map = useMap();
  const userRef = useRef(userPosition);

  useEffect(() => {
    userRef.current = userPosition;
  }, [userPosition]);

  // Only recenter when the app explicitly asks (search select / geolocate),
  // never on pan-driven reloads — otherwise the map fights the user's gestures.
  useEffect(() => {
    if (!map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    map.setZoom(15);
  }, [map, focus]);

  useEffect(() => {
    if (!map || !locateSignal) return;
    const pos = userRef.current;
    if (pos) {
      map.panTo(pos);
      map.setZoom(16);
    }
  }, [map, locateSignal]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onBoundsChanged({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [map, onBoundsChanged]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (event: MapClickEvent) => {
      if (event.placeId) {
        // Google POI clicked: suppress its default info window and use the id.
        event.stop?.();
        onMapClick({
          lat: event.latLng?.lat() ?? 0,
          lng: event.latLng?.lng() ?? 0,
          placeId: event.placeId,
        });
        return;
      }
      if (event.latLng) {
        onMapClick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      }
    });
    return () => listener.remove();
  }, [map, onMapClick]);

  return null;
}

export default function MapView({
  places,
  states,
  communitySummaries,
  selectedId,
  userPosition,
  locateSignal,
  focus,
  searchOrigin,
  onSelect,
  onBoundsChanged,
  onMapClick,
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
          focus={focus}
          locateSignal={locateSignal}
          userPosition={userPosition}
          onBoundsChanged={onBoundsChanged}
          onMapClick={onMapClick}
        />

        {/* Google-style red pin at the point the nearby search is centred on. */}
        {searchOrigin && (
          <AdvancedMarker position={searchOrigin} zIndex={1500} title="Search origin">
            <Pin
              background="#dc2626"
              borderColor="#ffffff"
              glyphColor="#ffffff"
              scale={1.1}
            />
          </AdvancedMarker>
        )}

        {userPosition && (
          <AdvancedMarker position={userPosition} zIndex={500} title="Your location">
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
                className="group relative flex cursor-pointer flex-col items-center p-1 focus:outline-none"
                aria-label={`${place.name}, ${TONE_LABELS[tone]}`}
              >
                {selected && (
                  <span className="pointer-events-none absolute left-1/2 top-0 h-9 w-9 -translate-x-1/2 animate-ping rounded-full bg-blue-500/30" />
                )}
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
