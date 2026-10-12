import { NextResponse, type NextRequest } from "next/server";
import type { CommunityVerdict } from "@/lib/community";
import { addReport, getSummary, ReportRateLimitError } from "@/lib/db";
import { IDENTITY_COOKIE, issueIdentity, verifyIdentity } from "@/lib/identity";
import { enforceRateLimit } from "@/lib/rateLimit";

const VERDICTS = new Set<CommunityVerdict>(["halal", "not_halal", "unclear"]);
const MAX_NOTE = 500;

interface ReportBody {
  placeId?: string;
  verdict?: string;
  note?: string;
}

/**
 * Store a user's own halal assessment (community contribution). This is
 * user-generated content only — never derived from the AI check.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "report", 10, 60_000);
  if (limited) return limited;

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

  // Identity is server-issued (signed, HttpOnly cookie), not client-supplied.
  let clientId = verifyIdentity(request.cookies.get(IDENTITY_COOKIE)?.value);
  let newCookie: string | null = null;
  if (!clientId) {
    const issued = issueIdentity();
    clientId = issued.id;
    newCookie = issued.cookie;
  }

  try {
    await addReport({
      placeId,
      verdict,
      note: body.note?.slice(0, MAX_NOTE),
      clientId,
    });
    const summary = await getSummary(placeId);
    const response = NextResponse.json({ summary });
    if (newCookie) {
      response.cookies.set(IDENTITY_COOKIE, newCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof ReportRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
