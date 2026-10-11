"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface Settings {
  autoValidate: boolean;
  autoValidateCap: number;
  radius: number;
}

export const DEFAULT_SETTINGS: Settings = {
  autoValidate: false,
  autoValidateCap: 25,
  radius: 1500,
};

const STORAGE_KEY = "halalsearch.settings";

let cachedRaw: string | null | undefined;
let cachedValue: Settings = DEFAULT_SETTINGS;

function readSettings(): Settings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = DEFAULT_SETTINGS;
    return cachedValue;
  }
  try {
    cachedValue = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    cachedValue = DEFAULT_SETTINGS;
  }
  return cachedValue;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Client settings persisted to localStorage, exposed as an external store. */
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, readSettings, getServerSnapshot);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...readSettings(), ...patch };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
    for (const listener of listeners) listener();
  }, []);

  return { settings, update, loaded: true };
}
