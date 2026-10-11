"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import SearchBox from "./SearchBox";
import SettingsPanel from "./SettingsPanel";
import PlaceCard from "./PlaceCard";
import { useSettings } from "./useSettings";
import { fetchNearby, streamValidate, validatePlace } from "@/lib/api";
import { haversineMeters } from "@/lib/distance";
import { DEFAULT_CENTER } from "@/lib/mapStyle";
import {
  TONE_COLORS,
  TONE_LABELS,
  type MarkerTone,
  type VerdictState,
} from "@/lib/status";
import type { Place, ValidateRequest } from "@/lib/types";

function toRequest(place: Place): ValidateRequest {
  return {
    placeId: place.placeId,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    osmTags: place.osmTags,
  };
}

const LEGEND_ORDER: MarkerTone[] = ["halal", "likely", "not", "unclear", "osm", "unknown"];

export default function HalalSearchApp() {
  const { settings, update, loaded } = useSettings();

  const [center, setCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [pinned, setPinned] = useState<Place[]>([]);
  const [states, setStates] = useState<Record<string, VerdictState>>({});
  const [selected, setSelected] = useState<Place | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<{ done: number; total: number } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const statesRef = useRef<Record<string, VerdictState>>({});
  const lastFetchRef = useRef<{ lat: number; lng: number } | null>(null);
  const autoRanRef = useRef<string>("");

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  // Ask for the browser location once.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      setGeoResolved(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setCenter(p);
        setGeoResolved(true);
      },
      (err) => {
        setGeoError(err.message);
        setGeoResolved(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const loadNearby = useCallback(
    async (lat: number, lng: number) => {
      lastFetchRef.current = { lat, lng };
      setNearbyLoading(true);
      setNearbyError(null);
      try {
        const list = await fetchNearby(lat, lng, settings.radius);
        setPlaces(list);
      } catch (err) {
        setNearbyError((err as Error).message);
      } finally {
        setNearbyLoading(false);
      }
    },
    [settings.radius],
  );

  useEffect(() => {
    if (!loaded || !geoResolved) return;
    void loadNearby(center.lat, center.lng);
  }, [center, loaded, geoResolved, loadNearby]);

  const handleBoundsChanged = useCallback((next: { lat: number; lng: number }) => {
    const last = lastFetchRef.current;
    if (!last) {
      setCenter(next);
      return;
    }
    if (haversineMeters(last.lat, last.lng, next.lat, next.lng) < 400) return;
    setCenter(next);
  }, []);

  const handleSelect = useCallback((place: Place) => {
    setSelected(place);
    setPinned((prev) =>
      prev.some((p) => p.placeId === place.placeId) ? prev : [place, ...prev],
    );
  }, []);

  const runSingleValidation = useCallback(async (place: Place) => {
    setStates((prev) => ({ ...prev, [place.placeId]: { status: "loading" } }));
    try {
      const verdict = await validatePlace(toRequest(place));
      setStates((prev) => ({
        ...prev,
        [verdict.placeId]: { status: "ready", verdict },
      }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [place.placeId]: { status: "error", message: (err as Error).message },
      }));
    }
  }, []);

  // Optional background auto-validation of the nearest N places.
  useEffect(() => {
    if (!loaded || !settings.autoValidate) return;
    const origin = position ?? center;
    const candidates = places
      .filter((p) => statesRef.current[p.placeId]?.status !== "ready")
      .map((p) => ({ place: p, d: haversineMeters(origin.lat, origin.lng, p.lat, p.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, settings.autoValidateCap)
      .map((x) => x.place);
    if (!candidates.length) return;

    const key = candidates.map((c) => c.placeId).join(",");
    if (autoRanRef.current === key) return;
    autoRanRef.current = key;

    const controller = new AbortController();
    setStates((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (next[c.placeId]?.status !== "ready") next[c.placeId] = { status: "loading" };
      }
      return next;
    });

    void streamValidate(
      candidates.map(toRequest),
      settings.autoValidateCap,
      {
        onVerdict: (verdict) =>
          setStates((prev) => ({
            ...prev,
            [verdict.placeId]: { status: "ready", verdict },
          })),
        onError: (placeId, message) =>
          setStates((prev) => ({ ...prev, [placeId]: { status: "error", message } })),
        onProgress: (done, total) => setAutoStatus({ done, total }),
        onDone: () => setAutoStatus(null),
      },
      controller.signal,
    ).catch((err) => {
      setAutoStatus(null);
      if ((err as Error).name !== "AbortError") setNearbyError((err as Error).message);
    });

    return () => controller.abort();
  }, [
    loaded,
    settings.autoValidate,
    settings.autoValidateCap,
    places,
    position,
    center,
  ]);

  const markers = useMemo(() => {
    const byId = new Map<string, Place>();
    for (const p of pinned) byId.set(p.placeId, p);
    for (const p of places) byId.set(p.placeId, p);
    const list = [...byId.values()];
    if (showAll) return list;
    return list.filter((p) => {
      const st = states[p.placeId];
      return (
        p.osmHalalSignal ||
        p.source === "geocode" ||
        st?.status === "ready" ||
        st?.status === "loading"
      );
    });
  }, [pinned, places, showAll, states]);

  const selectedDistance = useMemo(() => {
    if (!selected) return null;
    const origin = position ?? center;
    return haversineMeters(origin.lat, origin.lng, selected.lat, selected.lng);
  }, [selected, position, center]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100">
      <MapView
        center={center}
        places={markers}
        states={states}
        selectedId={selected?.placeId ?? null}
        userPosition={position}
        onSelect={handleSelect}
        onBoundsChanged={handleBoundsChanged}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto">
          <SearchBox
            bias={position ?? center}
            onSelect={(place) => {
              setPinned((prev) =>
                prev.some((p) => p.placeId === place.placeId)
                  ? prev
                  : [place, ...prev],
              );
              setSelected(place);
              setCenter({ lat: place.lat, lng: place.lng });
            }}
          />
        </div>
        <div className="pointer-events-auto">
          <SettingsPanel settings={settings} onChange={update} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[16rem] flex-col gap-2">
        {geoError && (
          <div className="pointer-events-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Location unavailable ({geoError}). Showing a default area — use search.
          </div>
        )}
        {nearbyError && (
          <div className="pointer-events-auto rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            Could not load nearby places: {nearbyError}
          </div>
        )}
        {nearbyLoading && (
          <div className="pointer-events-auto rounded-md bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow">
            Loading nearby places…
          </div>
        )}
        {autoStatus && (
          <div className="pointer-events-auto rounded-md bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow">
            Validating {autoStatus.done}/{autoStatus.total}…
          </div>
        )}

        <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow">
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all food places
          </label>
          <ul className="mt-2 space-y-1">
            {LEGEND_ORDER.map((tone) => (
              <li key={tone} className="flex items-center gap-2 text-slate-600">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-white shadow"
                  style={{ backgroundColor: TONE_COLORS[tone] }}
                />
                {TONE_LABELS[tone]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            {markers.length} place{markers.length === 1 ? "" : "s"} shown
          </p>
        </div>
      </div>

      {selected && (
        <div className="absolute bottom-3 right-3 z-10">
          <PlaceCard
            place={selected}
            state={states[selected.placeId]}
            distanceMeters={selectedDistance}
            onValidate={() => runSingleValidation(selected)}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}
