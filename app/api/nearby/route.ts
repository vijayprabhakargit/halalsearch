import { NextResponse, type NextRequest } from "next/server";
import { getNearbyPlaces } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "nearby", 60, 60_000);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = Math.min(Math.max(Number(sp.get("radius")) || 1500, 100), 5000);
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 60, 1), 200);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Query params 'lat' and 'lng' are required." },
      { status: 400 },
    );
  }

  try {
    const places = await getNearbyPlaces(lat, lng, radius, limit);
    return NextResponse.json({ places });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
