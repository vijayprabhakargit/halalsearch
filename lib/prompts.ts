import type { ValidateRequest } from "./types";

/** Build the grounded-research prompt used to assess a place's halal status. */
export function buildHalalPrompt(req: ValidateRequest): string {
  const tags: string[] = [];
  if (req.osmTags?.cuisine) tags.push(`cuisine=${req.osmTags.cuisine}`);
  if (req.osmTags?.["diet:halal"]) tags.push(`diet:halal=${req.osmTags["diet:halal"]}`);
  if (req.osmTags?.["diet:vegetarian"])
    tags.push(`diet:vegetarian=${req.osmTags["diet:vegetarian"]}`);
  if (req.osmTags?.["diet:vegan"]) tags.push(`diet:vegan=${req.osmTags["diet:vegan"]}`);

  const location =
    req.lat != null && req.lng != null ? `${req.lat},${req.lng}` : "unknown";

  return `You are a careful halal-dietary research assistant. Use current public information from Google Search to assess whether this specific food business is halal.

Business name: ${req.name}
Address: ${req.address ?? "unknown"}
Coordinates: ${location}
Known tags: ${tags.length ? tags.join(", ") : "none"}

Research and report, citing sources:
1. Is the meat zabiha / halal-certified? Name any certification body you can verify.
2. Does the establishment serve pork or alcohol?
3. Are there vegetarian/vegan/halal-friendly options?

Definitions and rules:
- "Halal" means permissible under Islamic dietary law. Strictly, meat must be zabiha (ritually slaughtered) and certified. Clearly flag when meat is NOT confirmed zabiha.
- A vegetarian or vegan establishment that serves no pork and no alcohol should be treated as halal-friendly.
- If evidence is missing or conflicting, prefer "unclear"; do not guess.
- If the business cannot be identified with confidence, return "unclear".

Respond with ONLY a JSON object inside a single \`\`\`json fenced block, using exactly this shape:
{
  "verdict": "halal" | "likely_halal" | "not_halal" | "unclear",
  "confidence": 0.0,
  "summary": "one or two sentence verdict",
  "evidence": ["short evidence bullet", "..."]
}
Do not output any text outside the \`\`\`json block.`;
}
