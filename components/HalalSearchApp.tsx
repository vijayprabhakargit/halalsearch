"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import SearchBox from "./SearchBox";
import SettingsPanel from "./SettingsPanel";
import PlaceCard from "./PlaceCard";
import DonateButton from "./DonateButton";
import { useSettings } from "./useSettings";
import {
  fetchNearby,
  fetchSummaries,
  streamValidate,
  submitReport,
  validatePlace,
} from "@/lib/api";
import type { CommunitySummary, CommunityVerdict } from "@/lib/community";
import { getClientId } from "@/lib/clientId";
import { haversineMeters } from "@/lib/distance";
import { DEFAULT_CENTER } from "@/lib/mapConfig";
import { TONE_COLORS, type VerdictState } from "@/lib/status";
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

type FilterKey = "halal" | "veg" | "community" | "unknown";

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: "halal", label: "Halal (Google)", color: TONE_COLORS.halal },
  { key: "veg", label: "Veg / Vegan", color: TONE_COLORS.tagged },
  { key: "community", label: "Community", color: TONE_COLORS.likely },
  { key: "unknown", label: "Not validated", color: TONE_COLORS.unknown },
];

export default function HalalSearchApp() {
  const { settings, update, loaded } = useSettings();
  const aiEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_CHECK === "1";

  const [center, setCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [pinned, setPinned] = useState<Place[]>([]);
  const [states, setStates] = useState<Record<string, VerdictState>>({});
  const [communitySummaries, setCommunitySummaries] = useState<
    Record<string, CommunitySummary>
  >({});
  const [selected, setSelected] = useState<Place | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<{ done: number; total: number } | null>(null);
  const [filters, setFilters] = useState({
    halal: true,
    veg: true,
    community: true,
    unknown: true,
  });
  const [viewCenter, setViewCenter] = useState(center);
  const [locateNonce, setLocateNonce] = useState(0);

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

  const loadSummaries = useCallback(async (list: Place[]) => {
    const ids = list.map((p) => p.placeId);
    if (ids.length === 0) return;
    try {
      const summaries = await fetchSummaries(ids);
      setCommunitySummaries((prev) => ({ ...prev, ...summaries }));
    } catch {
      // community data is best-effort; ignore failures
    }
  }, []);

  const loadNearby = useCallback(
    async (lat: number, lng: number) => {
      lastFetchRef.current = { lat, lng };
      setNearbyLoading(true);
      setNearbyError(null);
      try {
        const list = await fetchNearby(lat, lng, settings.radius);
        setPlaces(list);
        void loadSummaries(list);
      } catch (err) {
        setNearbyError((err as Error).message);
      } finally {
        setNearbyLoading(false);
      }
    },
    [settings.radius, loadSummaries],
  );

  useEffect(() => {
    if (!loaded || !geoResolved) return;
    void loadNearby(center.lat, center.lng);
  }, [center, loaded, geoResolved, loadNearby]);

  const handleBoundsChanged = useCallback((next: { lat: number; lng: number }) => {
    setViewCenter(next);
    const last = lastFetchRef.current;
    if (!last) {
      setCenter(next);
      return;
    }
    if (haversineMeters(last.lat, last.lng, next.lat, next.lng) < 400) return;
    setCenter(next);
  }, []);

  const handleLocate = useCallback(() => {
    if (position) {
      setCenter(position);
      setLocateNonce((n) => n + 1);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(p);
          setCenter(p);
          setGeoResolved(true);
          setLocateNonce((n) => n + 1);
        },
        (err) => setGeoError(err.message),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [position]);

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

  const handleReport = useCallback(
    async (place: Place, verdict: CommunityVerdict, note: string) => {
      const summary = await submitReport({
        placeId: place.placeId,
        verdict,
        note: note || undefined,
        clientId: getClientId(),
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        cuisine: place.cuisine,
        source: place.source,
      });
      setCommunitySummaries((prev) => ({ ...prev, [summary.placeId]: summary }));
    },
    [],
  );

  // Optional background auto-validation of the nearest N places.
  useEffect(() => {
    if (!loaded || !aiEnabled || !settings.autoValidate) return;
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
    aiEnabled,
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
    return [...byId.values()].filter((p) => {
      const st = states[p.placeId];
      // Always show searched and validated places.
      if (p.source === "geocode" || st?.status === "ready" || st?.status === "loading") {
        return true;
      }
      const community = communitySummaries[p.placeId]?.verdict;
      const halal = p.halalTagged;
      const veg = p.vegetarianTagged || p.veganTagged;
      if (halal && filters.halal) return true;
      if (veg && filters.veg) return true;
      if (community && filters.community) return true;
      if (!halal && !veg && !community) return filters.unknown;
      return false;
    });
  }, [pinned, places, filters, communitySummaries, states]);

  const showSearchArea =
    haversineMeters(viewCenter.lat, viewCenter.lng, center.lat, center.lng) > 200;

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
        communitySummaries={communitySummaries}
        selectedId={selected?.placeId ?? null}
        userPosition={position}
        locateSignal={locateNonce}
        onSelect={handleSelect}
        onBoundsChanged={handleBoundsChanged}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex w-[min(72vw,30rem)] flex-col gap-2">
          <SearchBox
            bias={position ?? center}
            nearby={places}
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
          <button
            type="button"
            onClick={handleLocate}
            className="flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            My location
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <DonateButton />
          <SettingsPanel settings={settings} aiEnabled={aiEnabled} onChange={update} />
        </div>
      </div>

      {showSearchArea && (
        <button
          type="button"
          onClick={() => setCenter(viewCenter)}
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
        >
          Search this area
        </button>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[16rem] flex-col gap-2">
        {geoError && (
          <div className="pointer-events-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Location unavailable ({geoError}). Showing a default area — use search.
          </div>
        )}
        {nearbyError && (
          <div className="pointer-events-auto rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p>Could not load nearby places: {nearbyError}</p>
            <button
              type="button"
              onClick={() => void loadNearby(center.lat, center.lng)}
              className="mt-1 rounded border border-red-300 bg-white px-2 py-0.5 font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Show
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filters[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, [f.key]: !prev[f.key] }))
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-white"
                    style={{ backgroundColor: f.color }}
                  />
                  {f.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Pin icon = place type · colour &amp; badge = halal status
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
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
            community={communitySummaries[selected.placeId]}
            aiEnabled={aiEnabled}
            onValidate={() => runSingleValidation(selected)}
            onReport={(verdict, note) => handleReport(selected, verdict, note)}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}
