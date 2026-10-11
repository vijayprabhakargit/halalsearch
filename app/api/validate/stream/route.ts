import type { NextRequest } from "next/server";
import { determineHalal } from "@/lib/gemini";
import type { ValidateRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

interface StreamBody {
  places?: ValidateRequest[];
  cap?: number;
  concurrency?: number;
}

const MAX_CAP = 100;

/**
 * Server-Sent Events endpoint: validates a batch of places with limited
 * concurrency and streams each verdict as it resolves. Used by the optional
 * "auto-validate nearby" mode.
 */
export async function POST(request: NextRequest) {
  let body: StreamBody;
  try {
    body = (await request.json()) as StreamBody;
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const all = Array.isArray(body.places) ? body.places : [];
  const cap = Math.min(Math.max(Number(body.cap) || all.length, 1), MAX_CAP);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 3, 1), 8);
  const list = all.slice(0, cap);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("start", { total: list.length });

      let cursor = 0;
      let done = 0;
      const worker = async () => {
        while (true) {
          const index = cursor++;
          if (index >= list.length) return;
          const req = list[index];
          try {
            const verdict = await determineHalal(req);
            send("verdict", verdict);
          } catch (error) {
            send("error", { placeId: req.placeId, message: (error as Error).message });
          }
          done += 1;
          send("progress", { done, total: list.length });
        }
      };

      try {
        await Promise.all(
          Array.from({ length: Math.min(concurrency, list.length) }, worker),
        );
        send("done", { total: list.length });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
