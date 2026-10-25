import "server-only";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiNotConfigured extends Error {}

interface Part {
  text?: string;
  thought?: boolean;
}

/** Streams Gemini text as plain UTF-8 chunks. The API key never leaves the server. */
export async function streamGemini(opts: { system: string; user: string; signal?: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiNotConfigured("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      // Thinking tokens count toward this budget, so leave headroom.
      generationConfig: { maxOutputTokens: 2048 },
    }),
    signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) {
    // Don't echo upstream bodies to clients: they can contain request details.
    console.error("gemini error", res.status, (await res.text()).slice(0, 500));
    throw new Error(`Upstream error ${res.status}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  return res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5));
            const parts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
            for (const p of parts) if (p.text && !p.thought) controller.enqueue(encoder.encode(p.text));
          } catch {
            // Ignore keep-alives and partial frames.
          }
        }
      },
    }),
  );
}
