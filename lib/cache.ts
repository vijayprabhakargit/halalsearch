interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Minimal in-memory TTL cache. Ephemeral by design: used only to avoid
 * re-running AI validation for the same place within a short session window.
 * No persistence (Gemini grounded results must not be stored long term).
 */
export class TtlCache<T> {
  private readonly map = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T): void {
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface GlobalCache {
  __halalVerdictCache?: TtlCache<unknown>;
}

/**
 * Process-wide verdict cache. Attached to globalThis so it survives module
 * reloads in dev and is shared by all route handlers in the same process.
 */
export function getVerdictCache<T>(): TtlCache<T> {
  const g = globalThis as GlobalCache;
  if (!g.__halalVerdictCache) {
    g.__halalVerdictCache = new TtlCache<unknown>(DEFAULT_TTL_MS);
  }
  return g.__halalVerdictCache as TtlCache<T>;
}
