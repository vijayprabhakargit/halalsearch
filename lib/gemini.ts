import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { getVerdictCache } from "./cache";
import { buildHalalPrompt } from "./prompts";
import type { Source, ValidateRequest, Verdict, VerdictValue } from "./types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Tried in order if the configured model is overloaded (503 "high demand"). */
const FALLBACK_MODELS = ["gemini-3.6-flash"];
const MAX_ATTEMPTS = 2;
const VALID_VERDICTS: VerdictValue[] = ["halal", "likely_halal", "not_halal", "unclear"];

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local or set GEMINI_MOCK=1 for offline mode.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      // Bound each request so an overloaded/slow call can't hang the endpoint.
      httpOptions: { timeout: 15_000 },
    });
  }
  return client;
}

function isMockMode(): boolean {
  return process.env.GEMINI_MOCK === "1";
}

export interface ParsedModelOutput {
  verdict: VerdictValue;
  confidence: number;
  summary: string;
  evidence: string[];
}

function coerceVerdict(value: unknown): VerdictValue {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if ((VALID_VERDICTS as string[]).includes(normalized)) {
      return normalized as VerdictValue;
    }
  }
  return "unclear";
}

export function parseModelOutput(text: string): ParsedModelOutput {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? "");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.3;
  const evidence = Array.isArray(parsed.evidence)
    ? parsed.evidence.filter((e): e is string => typeof e === "string").slice(0, 8)
    : [];
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length
      ? parsed.summary.trim()
      : text.trim().slice(0, 400);
  return { verdict: coerceVerdict(parsed.verdict), confidence, summary, evidence };
}

interface GroundingChunkLike {
  web?: { uri?: string; title?: string; domain?: string };
}

function extractSources(chunks: GroundingChunkLike[] | undefined): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks ?? []) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let title = chunk.web?.title || chunk.web?.domain;
    if (!title) {
      try {
        title = new URL(uri).hostname;
      } catch {
        title = "source";
      }
    }
    sources.push({ title, url: uri });
  }
  return sources;
}

function mockVerdict(req: ValidateRequest): Verdict {
  const hash = [...req.name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const verdict: VerdictValue = hash % 3 === 0 ? "halal" : hash % 3 === 1 ? "likely_halal" : "unclear";
  return {
    placeId: req.placeId,
    verdict,
    confidence: 0.5,
    summary: `Mock verdict for ${req.name} (GEMINI_MOCK=1).`,
    evidence: ["Mock mode: no external sources were queried."],
    sources: [],
    grounded: false,
    model: "mock",
    checkedAt: new Date().toISOString(),
    cached: false,
  };
}

/**
 * Assess whether a place is halal using Gemini grounded with Google Search.
 * Results are cached briefly in-memory only (grounded results must not be
 * persisted or used to build a database).
 */
export async function determineHalal(req: ValidateRequest): Promise<Verdict> {
  const cache = getVerdictCache<Verdict>();
  const cached = cache.get(req.placeId);
  if (cached) return { ...cached, cached: true };

  if (isMockMode()) {
    const verdict = mockVerdict(req);
    cache.set(req.placeId, verdict);
    return verdict;
  }

  const ai = getClient();
  const prompt = buildHalalPrompt(req);

  let response: GenerateContentResponse;
  let grounded = true;
  try {
    response = await generateResilient(ai, prompt, true);
  } catch (error) {
    if (!isGroundingUnavailable(error)) throw friendlyError(error);
    // Grounding needs billing enabled; fall back to an ungrounded answer.
    grounded = false;
    response = await generateResilient(ai, prompt, false);
  }

  const text = response.text ?? "";
  const parsed = parseModelOutput(text);
  const sources = grounded
    ? extractSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks)
    : [];

  const evidence = [...parsed.evidence];
  if (!grounded) {
    evidence.unshift(
      "Live web grounding is unavailable (quota/billing), so this is the model's own knowledge without cited sources.",
    );
  }

  const verdict: Verdict = {
    placeId: req.placeId,
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    summary: parsed.summary,
    evidence,
    sources,
    grounded,
    model: response.modelVersion ?? DEFAULT_MODEL,
    checkedAt: new Date().toISOString(),
    cached: false,
  };
  cache.set(req.placeId, verdict);
  return verdict;
}

function generate(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  grounded: boolean,
): Promise<GenerateContentResponse> {
  return ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.2,
      ...(grounded ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function modelCandidates(): string[] {
  return Array.from(new Set([DEFAULT_MODEL, ...FALLBACK_MODELS]));
}

/** Transient = Google-side capacity/timeout, worth retrying (not quota/auth). */
function isTransient(error: unknown): boolean {
  const e = error as { status?: number; code?: number; message?: string };
  const status = e?.status ?? e?.code;
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;
  const message = (e?.message ?? "").toUpperCase();
  return (
    message.includes("UNAVAILABLE") ||
    message.includes("HIGH DEMAND") ||
    message.includes("OVERLOAD") ||
    message.includes("TRY AGAIN")
  );
}

/**
 * Generate with retries on transient errors, falling back to alternate models
 * when the configured one is overloaded.
 */
async function generateResilient(
  ai: GoogleGenAI,
  prompt: string,
  grounded: boolean,
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  for (const model of modelCandidates()) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await generate(ai, model, prompt, grounded);
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) throw error;
        await delay(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function isGroundingUnavailable(error: unknown): boolean {
  const e = error as { status?: number; code?: number; message?: string };
  const status = e?.status ?? e?.code;
  if (status === 429 || status === 403) return true;
  const message = (e?.message ?? "").toUpperCase();
  return (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("QUOTA")
  );
}

/** Turn the SDK's JSON-in-a-string error into a readable message. */
function friendlyError(error: unknown): Error {
  const raw = (error as { message?: string })?.message ?? String(error);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) return new Error(parsed.error.message);
  } catch {
    // not JSON; use the raw message
  }
  return new Error(raw);
}
