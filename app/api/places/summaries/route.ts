import { NextResponse, type NextRequest } from "next/server";
import { getSummaries } from "@/lib/db";

const MAX_IDS = 300;

/** Batch-fetch community summaries for a set of place ids. */
export async function POST(request: NextRequest) {
  let body: { placeIds?: unknown };
  try {
    body = (await request.json()) as { placeIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const placeIds = Array.isArray(body.placeIds)
    ? body.placeIds.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];

  try {
    const summaries = await getSummaries(placeIds);
    return NextResponse.json({ summaries });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
