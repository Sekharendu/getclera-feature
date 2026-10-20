import { ExtractionError, extractionRequestSchema, MAX_REQUEST_BYTES, MAX_TEXT_LENGTH, type ProviderOutput } from "./contracts";
import { groundExtraction } from "./grounding";
import { BodyLimitError, readBoundedBody, TOTAL_TIMEOUT_MS } from "./provider";

type Extractor = (text: string, signal: AbortSignal) => Promise<ProviderOutput>;
function json(value: unknown, status: number) { return Response.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function error(code: string, message: string, status: number) { return json({ error: { code, message } }, status); }

/** Config is checked only after request validation. Handler never writes baseline or storage. */
export function createExtractionHandler(extract: Extractor) {
  return async function POST(request: Request): Promise<Response> {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return error("unsupported_media_type", "Send an application/json request.", 415);
    if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return error("input_too_large", "Description or request body exceeds the supported limit.", 413);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
    try {
      let body: string;
      try { body = await readBoundedBody(new Response(request.body), MAX_REQUEST_BYTES, controller.signal); }
      catch (cause) {
        if (controller.signal.aborted) throw new ExtractionError(request.signal.aborted ? "cancelled" : "timeout", request.signal.aborted ? 499 : 504);
        if (cause instanceof BodyLimitError) return error("input_too_large", "Description or request body exceeds the supported limit.", 413);
        return error("invalid_request", "Send a valid JSON object containing only a nonblank text field.", 400);
      }
      let input: unknown;
      try { input = JSON.parse(body); } catch { return error("invalid_request", "Send a valid JSON object containing only a nonblank text field.", 400); }
      if (input && typeof input === "object" && "text" in input && typeof input.text === "string" && input.text.length > MAX_TEXT_LENGTH) return error("input_too_large", "Description or request body exceeds the supported limit.", 413);
      const parsed = extractionRequestSchema.safeParse(input);
      if (!parsed.success) return error("invalid_request", "Send a valid JSON object containing only a nonblank text field.", 400);
      const output = await extract(parsed.data.text, controller.signal);
      if (controller.signal.aborted) throw new ExtractionError(request.signal.aborted ? "cancelled" : "timeout", request.signal.aborted ? 499 : 504);
      try { return json(groundExtraction(parsed.data.text, output), 200); }
      catch { throw new ExtractionError("invalid_output", 502); }
    } catch (cause) {
      const safe = cause instanceof ExtractionError ? cause : new ExtractionError("provider_error", 502);
      return error(safe.code, safe.message, safe.status);
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
  };
}
