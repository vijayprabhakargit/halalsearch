import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "search", 60, 60_000);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const query = sp.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Query param 'q' is required." },
      { status: 400 },
    );
  }
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const biasLat = Number.isFinite(lat) ? lat : undefined;
  const biasLng = Number.isFinite(lng) ? lng : undefined;

  try {
    const places = await searchPlaces(query, biasLat, biasLng);
    return NextResponse.json({ places });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
