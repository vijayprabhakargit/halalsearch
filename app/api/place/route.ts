import { NextResponse, type NextRequest } from "next/server";
import { getSummary } from "@/lib/db";
import { getPlaceDetails } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * On-demand place details: fetch the place's Google halal/veg tags plus its
 * community summary. Called when a user opens a place.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "place", 60, 60_000);
  if (limited) return limited;

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "Query param 'id' is required." },
      { status: 400 },
    );
  }

  try {
    const [place, summary] = await Promise.all([
      getPlaceDetails(id),
      getSummary(id),
    ]);
    return NextResponse.json({ place, summary });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
