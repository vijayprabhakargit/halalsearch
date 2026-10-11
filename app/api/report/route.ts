import { NextResponse, type NextRequest } from "next/server";
import type { CommunityVerdict } from "@/lib/community";
import { addReport, getSummary } from "@/lib/db";

const VERDICTS = new Set<CommunityVerdict>(["halal", "not_halal", "unclear"]);
const MAX_NOTE = 500;

interface ReportBody {
  placeId?: string;
  verdict?: string;
  note?: string;
  clientId?: string;
  name?: string;
  lat?: number;
  lng?: number;
  address?: string;
  cuisine?: string;
  source?: string;
}

/**
 * Store a user's own halal assessment (community contribution). This is
 * user-generated content only — never derived from the AI check.
 */
export async function POST(request: NextRequest) {
  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const placeId = body.placeId?.trim();
  const verdict = body.verdict as CommunityVerdict | undefined;
  if (!placeId || !verdict || !VERDICTS.has(verdict)) {
    return NextResponse.json(
      { error: "Fields 'placeId' and a valid 'verdict' are required." },
      { status: 400 },
    );
  }

  try {
    await addReport({
      placeId,
      verdict,
      note: body.note?.slice(0, MAX_NOTE),
      clientId: body.clientId?.slice(0, 64),
      name: body.name,
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
      address: body.address,
      cuisine: body.cuisine,
      source: body.source,
    });
    const summary = await getSummary(placeId);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
