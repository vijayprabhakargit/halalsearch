import { GoogleGenAI } from "@google/genai";
import { getVerdictCache } from "./cache";
import { buildHalalPrompt } from "./prompts";
import type { Source, ValidateRequest, Verdict, VerdictValue } from "./types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const VALID_VERDICTS: VerdictValue[] = ["halal", "likely_halal", "not_halal", "unclear"];

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local or set GEMINI_MOCK=1 for offline mode.",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
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
  const model = DEFAULT_MODEL;
  const response = await ai.models.generateContent({
    model,
    contents: buildHalalPrompt(req),
    config: {
      temperature: 0.2,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text ?? "";
  const parsed = parseModelOutput(text);
  const sources = extractSources(
    response.candidates?.[0]?.groundingMetadata?.groundingChunks,
  );

  const verdict: Verdict = {
    placeId: req.placeId,
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    summary: parsed.summary,
    evidence: parsed.evidence,
    sources,
    model: response.modelVersion ?? model,
    checkedAt: new Date().toISOString(),
    cached: false,
  };
  cache.set(req.placeId, verdict);
  return verdict;
}
