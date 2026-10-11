"use client";

import "@/lib/maplibreWorker";
import { useEffect, useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/mapStyle";
import { markerTone, TONE_LABELS, type VerdictState } from "@/lib/status";
import { haversineMeters } from "@/lib/distance";
import type { CommunitySummary } from "@/lib/community";
import type { Place } from "@/lib/types";
import PlacePin, { cuisineCategory } from "./PlacePin";

interface MapViewProps {
  center: { lat: number; lng: number };
  places: Place[];
  states: Record<string, VerdictState>;
  communitySummaries: Record<string, CommunitySummary>;
  selectedId: string | null;
  userPosition: { lat: number; lng: number } | null;
  locateSignal: number;
  tileFallbackSignal: number;
  onSelect: (place: Place) => void;
  onBoundsChanged: (center: { lat: number; lng: number }) => void;
  onTilePlaces: (places: Place[]) => void;
}

const FOOD_POI_CLASSES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "ice_cream",
  "bakery",
]);

interface TileFeature {
  sourceLayer?: string;
  properties?: Record<string, unknown> | null;
  geometry: { type?: string; coordinates?: unknown };
}

export default function MapView({
  center,
  places,
  states,
  communitySummaries,
  selectedId,
  userPosition,
  locateSignal,
  tileFallbackSignal,
  onSelect,
  onBoundsChanged,
  onTilePlaces,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const lastFlyTo = useRef<string>("");
  const userPosRef = useRef(userPosition);

  useEffect(() => {
    userPosRef.current = userPosition;
  }, [userPosition]);

  // Fly to the searched center when it changes.
  useEffect(() => {
    const key = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
    if (lastFlyTo.current === key) return;
    lastFlyTo.current = key;
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: 15, duration: 800 });
  }, [center.lat, center.lng]);

  // Fly to the user's location when the locate button is pressed.
  useEffect(() => {
    if (!locateSignal) return;
    const pos = userPosRef.current;
    if (pos) {
      mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 16, duration: 800 });
    }
  }, [locateSignal]);

  // Fallback when Overpass is unavailable: derive nearby food places from the
  // vector-tile POIs the map has already loaded. No external request needed.
  useEffect(() => {
    if (!tileFallbackSignal) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let cancelled = false;
    let attempts = 0;

    const collectFoodPois = (): Place[] => {
      const seen = new Set<string>();
      const found: Place[] = [];
      const collect = (features: TileFeature[]) => {
        for (const feature of features) {
          if (feature.sourceLayer !== "poi") continue;
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          const cls = String(props.class ?? "");
          if (!FOOD_POI_CLASSES.has(cls)) continue;
          const name = String(
            props.name ?? props.name_en ?? props["name:latin"] ?? "",
          ).trim();
          if (!name) continue;
          const geometry = feature.geometry;
          if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)) continue;
          const [lng, lat] = geometry.coordinates as [number, number];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const placeId = `tile/${lat.toFixed(5)},${lng.toFixed(5)}`;
          if (seen.has(placeId)) continue;
          seen.add(placeId);
          found.push({
            placeId,
            name,
            lat,
            lng,
            cuisine: typeof props.subclass === "string" ? props.subclass : undefined,
            osmTags: {},
            osmHalalSignal: false,
            source: "tile",
          });
        }
      };

      try {
        collect(map.queryRenderedFeatures() as unknown as TileFeature[]);
        collect(
          map.querySourceFeatures("openmaptiles", {
            sourceLayer: "poi",
          }) as unknown as TileFeature[],
        );
      } catch {
        // style/tiles not ready yet; retry below
      }
      return found;
    };

    const run = () => {
      if (cancelled) return;
      const found = collectFoodPois();
      if (process.env.NODE_ENV !== "production") {
        console.log("[tile-fallback] attempt", attempts, "found", found.length, found[0]);
      }
      // Tiles may still be loading — retry a few times before giving up.
      if (found.length === 0 && attempts < 5) {
        attempts += 1;
        window.setTimeout(run, 1000);
        return;
      }
      const mapCenter = map.getCenter();
      found.sort(
        (a, b) =>
          haversineMeters(a.lat, a.lng, mapCenter.lat, mapCenter.lng) -
          haversineMeters(b.lat, b.lng, mapCenter.lat, mapCenter.lng),
      );
      onTilePlaces(found.slice(0, 100));
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tileFallbackSignal, onTilePlaces]);

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
            className="relative flex h-8 w-8 items-center justify-center"
            aria-label="Your location"
          >
            <span className="absolute h-8 w-8 rounded-full bg-blue-500/20" />
            <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-500/30" />
            <span className="relative h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow-md" />
          </span>
        </Marker>
      )}

      {places.map((place) => {
        const tone = markerTone(
          place,
          states[place.placeId],
          communitySummaries[place.placeId]?.verdict ?? null,
        );
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
              aria-label={`${place.name}, ${TONE_LABELS[tone]}`}
              onClick={() => onSelect(place)}
              className="group flex cursor-pointer flex-col items-center p-1 focus:outline-none"
            >
              <PlacePin
                tone={tone}
                category={cuisineCategory(place.cuisine)}
                selected={selected}
              />
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
