import { describe, expect, it } from "vitest";
import { parseModelOutput } from "./gemini";

describe("parseModelOutput", () => {
  it("parses a fenced JSON block", () => {
    const text =
      'Here you go:\n```json\n{"verdict":"halal","confidence":0.9,"summary":"Certified.","evidence":["Has certificate"]}\n```';
    const parsed = parseModelOutput(text);
    expect(parsed.verdict).toBe("halal");
    expect(parsed.confidence).toBe(0.9);
    expect(parsed.summary).toBe("Certified.");
    expect(parsed.evidence).toEqual(["Has certificate"]);
  });

  it("parses a bare JSON object", () => {
    const parsed = parseModelOutput('{"verdict":"not_halal","confidence":2}');
    expect(parsed.verdict).toBe("not_halal");
    expect(parsed.confidence).toBe(1);
  });

  it("normalizes verdict casing and separators", () => {
    expect(parseModelOutput('{"verdict":"Likely Halal"}').verdict).toBe("likely_halal");
    expect(parseModelOutput('{"verdict":"likely-halal"}').verdict).toBe("likely_halal");
  });

  it("falls back to unclear for unknown verdicts and bad JSON", () => {
    expect(parseModelOutput('{"verdict":"maybe"}').verdict).toBe("unclear");
    expect(parseModelOutput("no json here").verdict).toBe("unclear");
  });

  it("clamps confidence into 0..1 and defaults when missing", () => {
    expect(parseModelOutput('{"verdict":"halal","confidence":-3}').confidence).toBe(0);
    expect(parseModelOutput('{"verdict":"halal"}').confidence).toBe(0.3);
  });
});
