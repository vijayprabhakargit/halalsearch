import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addReport,
  getSummaries,
  getSummary,
  resetDbForTests,
  upsertPlace,
} from "./db";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "halal-db-"));
  process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  delete process.env.TURSO_DATABASE_URL;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may briefly hold the file lock; the temp dir is disposable
  }
});

describe("community db", () => {
  it("stores reports and aggregates a summary", async () => {
    await addReport({ placeId: "node/1", verdict: "halal", name: "A", lat: 1, lng: 2, source: "osm" });
    await addReport({ placeId: "node/1", verdict: "halal" });
    await addReport({ placeId: "node/1", verdict: "not_halal" });

    const summary = await getSummary("node/1");
    expect(summary.halal).toBe(2);
    expect(summary.notHalal).toBe(1);
    expect(summary.unclear).toBe(0);
    expect(summary.total).toBe(3);
    expect(summary.verdict).toBe("halal");
  });

  it("returns an empty summary for an unknown place", async () => {
    const summary = await getSummary("node/missing");
    expect(summary.total).toBe(0);
    expect(summary.verdict).toBeNull();
    expect(summary.halalRatio).toBeNull();
  });

  it("batch-fetches summaries and omits places with no reports", async () => {
    await addReport({ placeId: "a", verdict: "halal" });
    await addReport({ placeId: "b", verdict: "not_halal" });
    const map = await getSummaries(["a", "b", "c"]);
    expect(map.a.halal).toBe(1);
    expect(map.b.notHalal).toBe(1);
    expect(map.c).toBeUndefined();
  });

  it("upserts places without error", async () => {
    await upsertPlace({ placeId: "p", name: "Old", lat: 0, lng: 0 });
    await upsertPlace({ placeId: "p", name: "New", lat: 1, lng: 1, cuisine: "kebab" });
    const summary = await getSummary("p");
    expect(summary.total).toBe(0);
  });
});
