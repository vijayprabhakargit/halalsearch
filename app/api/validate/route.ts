import { NextResponse, type NextRequest } from "next/server";
import { determineHalal } from "@/lib/gemini";
import type { ValidateRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
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
