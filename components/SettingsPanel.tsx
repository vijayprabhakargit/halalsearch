"use client";

import { useState } from "react";
import type { Settings } from "./useSettings";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
      >
        Settings
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Search radius</span>
            <select
              value={settings.radius}
              onChange={(e) => onChange({ radius: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            >
              <option value={500}>500 m</option>
              <option value={1000}>1 km</option>
              <option value={1500}>1.5 km</option>
              <option value={3000}>3 km</option>
              <option value={5000}>5 km</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
