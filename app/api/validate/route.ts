import { NextResponse, type NextRequest } from "next/server";
import { determineHalal } from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rateLimit";
import type { ValidateRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "validate", 20, 60_000);
  if (limited) return limited;

  let body: ValidateRequest;
  try {
    body = (await request.json()) as ValidateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.placeId || !body?.name) {
    return NextResponse.json(
      { error: "Fields 'placeId' and 'name' are required." },
      { status: 400 },
    );
  }

  try {
    const verdict = await determineHalal(body);
    return NextResponse.json(verdict);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
