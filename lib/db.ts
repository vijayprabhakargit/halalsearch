import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildSummary,
  emptySummary,
  type CommunitySummary,
  type CommunityVerdict,
} from "./community";

/** Local file DB by default; point TURSO_DATABASE_URL at Turso in production. */
const DEFAULT_URL = "file:./data/halal.db";

let client: Client | null = null;
let clientUrl: string | null = null;
let schemaReady: Promise<void> | null = null;

function resolveUrl(): string {
  return process.env.TURSO_DATABASE_URL || DEFAULT_URL;
}

function ensureFileDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (!path || path.startsWith(":")) return; // in-memory
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // best effort; the client will surface a real error if it can't open
  }
}

function getClient(): Client {
  const url = resolveUrl();
  if (!client || clientUrl !== url) {
    ensureFileDir(url);
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient(authToken ? { url, authToken } : { url });
    clientUrl = url;
    schemaReady = null;
  }
  return client;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const c = getClient();
    schemaReady = (async () => {
      await c.execute(`
        CREATE TABLE IF NOT EXISTS places (
          place_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          address TEXT,
          cuisine TEXT,
          source TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await c.execute(`
        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          place_id TEXT NOT NULL,
          verdict TEXT NOT NULL,
          note TEXT,
          client_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await c.execute(
        `CREATE INDEX IF NOT EXISTS idx_reports_place ON reports(place_id)`,
      );
      // De-dupe any existing rows, then enforce one report per (place, identity).
      await c.execute(
        `DELETE FROM reports WHERE id NOT IN (SELECT MAX(id) FROM reports GROUP BY place_id, client_id)`,
      );
      await c.execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_place_client ON reports(place_id, client_id)`,
      );
    })();
  }
  return schemaReady;
}

export interface PlaceInput {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  cuisine?: string;
  source?: string;
}

export async function upsertPlace(place: PlaceInput): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT INTO places (place_id, name, lat, lng, address, cuisine, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(place_id) DO UPDATE SET
            name = excluded.name,
            lat = excluded.lat,
            lng = excluded.lng,
            address = excluded.address,
            cuisine = excluded.cuisine,
            source = excluded.source,
            updated_at = datetime('now')`,
    args: [
      place.placeId,
      place.name,
      place.lat,
      place.lng,
      place.address ?? null,
      place.cuisine ?? null,
      place.source ?? null,
    ],
  });
}

export interface ReportInput {
  placeId: string;
  verdict: CommunityVerdict;
  note?: string;
  clientId?: string;
  /** Optional place details to upsert alongside the report. */
  name?: string;
  lat?: number;
  lng?: number;
  address?: string;
  cuisine?: string;
  source?: string;
}

/** Thrown when a place has received too many reports in a short window. */
export class ReportRateLimitError extends Error {}

const PLACE_REPORT_CAP = 8;
const PLACE_REPORT_WINDOW = "-1 hour";

export async function addReport(report: ReportInput): Promise<void> {
  await ensureSchema();
  const client = getClient();
  const clientId = report.clientId ?? randomUUID();

  if (report.name && report.lat != null && report.lng != null) {
    await upsertPlace({
      placeId: report.placeId,
      name: report.name,
      lat: report.lat,
      lng: report.lng,
      address: report.address,
      cuisine: report.cuisine,
      source: report.source,
    });
  }

  // Cap bursts of fresh reports on the same place (DB-counted, so it holds
  // across instances). Re-voting by the same identity updates the existing row
  // and is always allowed.
  const existing = await client.execute({
    sql: `SELECT id FROM reports WHERE place_id = ? AND client_id = ?`,
    args: [report.placeId, clientId],
  });
  if (existing.rows.length === 0) {
    const count = await client.execute({
      sql: `SELECT COUNT(*) AS n FROM reports WHERE place_id = ? AND created_at >= datetime('now', ?)`,
      args: [report.placeId, PLACE_REPORT_WINDOW],
    });
    if (Number(count.rows[0]?.n ?? 0) >= PLACE_REPORT_CAP) {
      throw new ReportRateLimitError(
        "This place has received many reports recently. Please try again later.",
      );
    }
  }

  await client.execute({
    sql: `INSERT INTO reports (place_id, verdict, note, client_id, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(place_id, client_id) DO UPDATE SET
            verdict = excluded.verdict,
            note = excluded.note`,
    args: [report.placeId, report.verdict, report.note ?? null, clientId],
  });
}

const AGGREGATE_SELECT = `
  SELECT place_id,
         SUM(CASE WHEN verdict = 'halal' THEN 1 ELSE 0 END) AS halal,
         SUM(CASE WHEN verdict = 'not_halal' THEN 1 ELSE 0 END) AS not_halal,
         SUM(CASE WHEN verdict = 'unclear' THEN 1 ELSE 0 END) AS unclear,
         MAX(created_at) AS last_updated
  FROM reports
`;

function rowToSummary(row: Record<string, unknown>): CommunitySummary {
  return buildSummary(
    String(row.place_id),
    {
      halal: Number(row.halal ?? 0),
      notHalal: Number(row.not_halal ?? 0),
      unclear: Number(row.unclear ?? 0),
    },
    (row.last_updated as string | null) ?? null,
  );
}

export async function getSummary(placeId: string): Promise<CommunitySummary> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: `${AGGREGATE_SELECT} WHERE place_id = ?`,
    args: [placeId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row || row.place_id == null) return emptySummary(placeId);
  return rowToSummary(row);
}

export async function getSummaries(
  placeIds: string[],
): Promise<Record<string, CommunitySummary>> {
  const out: Record<string, CommunitySummary> = {};
  if (placeIds.length === 0) return out;
  await ensureSchema();
  const placeholders = placeIds.map(() => "?").join(",");
  const result = await getClient().execute({
    sql: `${AGGREGATE_SELECT} WHERE place_id IN (${placeholders}) GROUP BY place_id`,
    args: placeIds,
  });
  for (const raw of result.rows) {
    const summary = rowToSummary(raw as Record<string, unknown>);
    out[summary.placeId] = summary;
  }
  return out;
}

/** Lightweight connectivity check for the health endpoint. */
export async function pingDb(): Promise<void> {
  await ensureSchema();
  await getClient().execute("SELECT 1");
}

/** Test helper: close and drop the cached client so a new URL/env takes effect. */
export function resetDbForTests(): void {
  try {
    client?.close();
  } catch {
    // ignore close errors
  }
  client = null;
  clientUrl = null;
  schemaReady = null;
}
