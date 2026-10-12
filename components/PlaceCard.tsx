"use client";

import { useState } from "react";
import CommunitySection from "./CommunitySection";
import Disclaimer from "./Disclaimer";
import GoogleSearchPane from "./GoogleSearchPane";
import Section from "./Section";
import type { CommunitySummary, CommunityVerdict } from "@/lib/community";
import { formatDistance } from "@/lib/distance";
import type { VerdictState } from "@/lib/status";
import { VERDICT_LABELS, type Place, type VerdictValue } from "@/lib/types";

const VERDICT_STYLES: Record<VerdictValue, string> = {
  halal: "border-green-300 bg-green-100 text-green-800",
  likely_halal: "border-green-200 bg-green-50 text-green-700",
  not_halal: "border-red-300 bg-red-100 text-red-800",
  unclear: "border-amber-300 bg-amber-100 text-amber-800",
};

interface PlaceCardProps {
  place: Place;
  state: VerdictState | undefined;
  distanceMeters: number | null;
  community: CommunitySummary | undefined;
  aiEnabled: boolean;
  onValidate: () => void;
  onReport: (verdict: CommunityVerdict, note: string) => Promise<void>;
  onClose: () => void;
}

function dataSourceLabel(place: Place): string {
  return place.source === "google" ? "Google Maps" : "the map data";
}

function googleMapsUrl(place: Place): string {
  const query =
    place.address && place.address.length > 0
      ? `${place.name}, ${place.address}`
      : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function PlaceCard({
  place,
  state,
  distanceMeters,
  community,
  aiEnabled,
  onValidate,
  onReport,
  onClose,
}: PlaceCardProps) {
  const verdict = state?.status === "ready" ? state.verdict : null;
  const loading = state?.status === "loading";
  const error = state?.status === "error" ? state.message : null;
  const [showGooglePane, setShowGooglePane] = useState(false);

  // Google Programmable Search Engine is kept in code but hidden unless enabled.
  const cseEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_CSE === "1";
  const cseCx = process.env.NEXT_PUBLIC_GOOGLE_CSE_CX;
  const googleQuery = `${place.name}${place.address ? `, ${place.address}` : ""} halal`;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

  return (
    <div className="flex max-h-[70dvh] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">
            {place.name}
          </h2>
          {place.address && (
            <p className="mt-0.5 text-xs text-slate-500">{place.address}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {place.cuisine && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                {place.cuisine}
              </span>
            )}
            {place.halalTagged && (
              <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-700">
                Halal — labelled on {dataSourceLabel(place)}
              </span>
            )}
            {!place.halalTagged && (place.vegetarianTagged || place.veganTagged) && (
              <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-700">
                Halal-friendly (vegetarian)
              </span>
            )}
            {distanceMeters != null && (
              <span className="text-slate-500">{formatDistance(distanceMeters)} away</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Section title="Community" defaultOpen>
          <CommunitySection place={place} summary={community} onReport={onReport} />
        </Section>

        {aiEnabled && (
          <Section
            title="AI confirmation"
            right={
              verdict ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    VERDICT_STYLES[verdict.verdict]
                  }`}
                >
                  {VERDICT_LABELS[verdict.verdict]}
                </span>
              ) : undefined
            }
          >
            {verdict ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-sm font-semibold ${
                      VERDICT_STYLES[verdict.verdict]
                    }`}
                  >
                    {VERDICT_LABELS[verdict.verdict]}
                  </span>
                  <span className="text-xs text-slate-500">
                    confidence {Math.round(verdict.confidence * 100)}%
                  </span>
                  {verdict.cached && (
                    <span className="text-xs text-slate-400">(cached)</span>
                  )}
                </div>

                <p className="text-sm text-slate-700">{verdict.summary}</p>

                {verdict.evidence.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {verdict.evidence.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}

                {!verdict.grounded && (
                  <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    Not web-verified: live search grounding is unavailable, so this
                    answer has no cited sources.
                  </p>
                )}

                {verdict.sources.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sources
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {verdict.sources.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Checked {new Date(verdict.checkedAt).toLocaleString()} · {verdict.model}
                </p>

                <button
                  type="button"
                  onClick={onValidate}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Re-check
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  No AI confirmation yet. Run a grounded Google Search check to assess
                  whether this place is halal.
                </p>
                <button
                  type="button"
                  onClick={onValidate}
                  disabled={loading}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Validating…" : "Validate with AI"}
                </button>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            )}
          </Section>
        )}

        <Section title="Check it yourself">
          <div className="space-y-2">
            <a
              href={googleUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Search Google (new tab)
            </a>
            {cseEnabled && cseCx && (
              <>
                <button
                  type="button"
                  onClick={() => setShowGooglePane((v) => !v)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {showGooglePane ? "Hide Google results" : "Show Google results here"}
                </button>
                {showGooglePane && <GoogleSearchPane query={googleQuery} cx={cseCx} />}
              </>
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-2 border-t border-slate-100 p-4">
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noreferrer noopener"
          className="block rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open in Google Maps
        </a>
        <Disclaimer />
      </div>
    </div>
  );
}
