import type { Place, ValidateRequest, Verdict } from "./types";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

export async function fetchNearby(
  lat: number,
  lng: number,
  radius: number,
): Promise<Place[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });
  const res = await fetch(`/api/nearby?${params.toString()}`);
  const data = await readJson<{ places: Place[] }>(res);
  return data.places;
}

export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number,
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }
  const res = await fetch(`/api/search?${params.toString()}`);
  const data = await readJson<{ places: Place[] }>(res);
  return data.places;
}

export async function validatePlace(req: ValidateRequest): Promise<Verdict> {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return readJson<Verdict>(res);
}

export interface StreamHandlers {
  onVerdict?: (verdict: Verdict) => void;
  onProgress?: (done: number, total: number) => void;
  onError?: (placeId: string, message: string) => void;
  onDone?: (total: number) => void;
}

/**
 * Validate a batch of places via the SSE endpoint and invoke handlers as events
 * arrive. Uses fetch + a stream reader (SSE over POST).
 */
export async function streamValidate(
  places: ValidateRequest[],
  cap: number,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/validate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ places, cap, concurrency: 3 }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    switch (event) {
      case "verdict":
        handlers.onVerdict?.(payload as Verdict);
        break;
      case "progress": {
        const p = payload as { done: number; total: number };
        handlers.onProgress?.(p.done, p.total);
        break;
      }
      case "error": {
        const e = payload as { placeId: string; message: string };
        handlers.onError?.(e.placeId, e.message);
        break;
      }
      case "done": {
        const d = payload as { total: number };
        handlers.onDone?.(d.total);
        break;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (block.trim()) dispatch(block);
    }
  }
}
