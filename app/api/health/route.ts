import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe: process is up and the community DB is reachable. */
export async function GET() {
  let db = "ok";
  try {
    await pingDb();
  } catch {
    db = "error";
  }
  return NextResponse.json(
    { ok: db === "ok", db, time: new Date().toISOString() },
    { status: db === "ok" ? 200 : 503 },
  );
}
