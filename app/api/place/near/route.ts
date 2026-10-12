import { NextResponse, type NextRequest } from "next/server";
import { getSummary } from "@/lib/db";
import { getPlaceAtPoint } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * On-demand: find the food place at a clicked map point (tiny Nearby search) and
 * return its Google halal/veg tags plus the community summary.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "place-near", 60, 60_000);
  if (limited) return limited;

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Query params 'lat' and 'lng' are required." },
      { status: 400 },
    );
  }

  try {
    const place = await getPlaceAtPoint(lat, lng);
    if (!place) return NextResponse.json({ place: null, summary: null });
    const summary = await getSummary(place.placeId);
    return NextResponse.json({ place, summary });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
