"use client";

import { useState } from "react";
import type { CommunitySummary, CommunityVerdict } from "@/lib/community";
import { VERDICT_LABELS, type Place, type VerdictValue } from "@/lib/types";

const VERDICT_STYLES: Record<VerdictValue, string> = {
  halal: "border-green-300 bg-green-100 text-green-800",
  likely_halal: "border-green-200 bg-green-50 text-green-700",
  not_halal: "border-red-300 bg-red-100 text-red-800",
  unclear: "border-amber-300 bg-amber-100 text-amber-800",
};

const OPTIONS: { value: CommunityVerdict; label: string }[] = [
  { value: "halal", label: "Halal" },
  { value: "not_halal", label: "Not halal" },
  { value: "unclear", label: "Unclear" },
];

interface CommunitySectionProps {
  place: Place;
  summary: CommunitySummary | undefined;
  onReport: (verdict: CommunityVerdict, note: string) => Promise<void>;
}

export default function CommunitySection({
  place,
  summary,
  onReport,
}: CommunitySectionProps) {
  const [selected, setSelected] = useState<CommunityVerdict | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReport(selected, note.trim());
      setDone(true);
      setSelected(null);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Community
      </p>

      {summary && summary.total > 0 ? (
        <div className="space-y-1">
          {summary.verdict ? (
            <span
              className={`inline-block rounded-full border px-2.5 py-1 text-sm font-semibold ${
                VERDICT_STYLES[summary.verdict]
              }`}
            >
              {VERDICT_LABELS[summary.verdict]}
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Not enough reports to decide yet.
            </span>
          )}
          <p className="text-xs text-slate-600">
            {summary.halal} halal · {summary.notHalal} not halal ·{" "}
            {summary.unclear} unclear
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No community reports yet for {place.name}.
        </p>
      )}

      {done ? (
        <p className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
          Thanks — your assessment was saved.
        </p>
      ) : (
        <div className="space-y-2 rounded-md border border-slate-200 p-2">
          <p className="text-xs font-medium text-slate-600">
            Add your own assessment
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelected(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  selected === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            maxLength={500}
            placeholder="Optional note (e.g. zabiha certified)"
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!selected || submitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Submit assessment"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-slate-400">
            Your own assessment — not the AI result. Please be accurate; others rely on it.
          </p>
        </div>
      )}
    </div>
  );
}
