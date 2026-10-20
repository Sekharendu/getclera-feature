import { describe, expect, it, vi } from "vitest";
import { ExtractionError } from "@/lib/extraction/contracts";
import { createExtractionHandler } from "@/lib/extraction/handler";
import { output } from "../helpers/extraction";

function request(body: unknown) { return new Request("http://localhost/api/extract-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
describe("extraction HTTP contract", () => {
  it.each([{}, { text: "" }, { text: " \n " }, { text: "text", extra: true }, { text: 123 }])("validates before provider configuration %#", async (body) => {
    const extract = vi.fn().mockRejectedValue(new ExtractionError("not_configured", 503));
    expect((await createExtractionHandler(extract)(request(body))).status).toBe(400); expect(extract).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON, unsupported media, oversized text and stream body", async () => {
    const extract = vi.fn().mockResolvedValue(output()); const handler = createExtractionHandler(extract);
    expect((await handler(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
    expect((await handler(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: new Uint8Array([0xff]) }))).status).toBe(400);
    expect((await handler(new Request("http://localhost", { method: "POST", body: "text" }))).status).toBe(415);
    expect((await handler(request({ text: "x".repeat(20001) }))).status).toBe(413);
    expect((await handler(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: " ".repeat(128 * 1024 + 1) }))).status).toBe(413);
    expect(extract).not.toHaveBeenCalled();
  });
  it("accepts20k boundary preserving whitespace and returns proposed role/no-store", async () => {
    const extract = vi.fn().mockResolvedValue(output([])); const text = " \n" + "x".repeat(19997) + " ";
    expect(text.length).toBe(20000);
    const response = await createExtractionHandler(extract)(request({ text }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect((await response.json()).draftRole.sources[0].text).toBe(text);
    expect(extract.mock.calls[0][0]).toBe(text);
  });
  it.each([["not_configured", 503], ["timeout", 504], ["invalid_output", 502], ["provider_error", 502]] as const)("returns safe %s error", async (code, status) => {
    const response = await createExtractionHandler(async () => { throw new ExtractionError(code, status); })(request({ text: "private input" }));
    expect(response.status).toBe(status); const body = await response.text(); expect(body).not.toContain("private input"); expect(JSON.parse(body).error.code).toBe(code);
  });
  it("sanitizes arbitrary provider errors and invalid returned structure", async () => {
    const response = await createExtractionHandler(async () => { throw Error("secret and raw user text"); })(request({ text: "private input" }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("secret");
    expect((await createExtractionHandler(async () => ({ wrong: true }) as never)(request({ text: "text" }))).status).toBe(502);
  });
  it.each(["deadline", "caller"])("cancels a hanging incoming request body on %s and never calls extractor", async (reason) => {
    vi.useFakeTimers();
    try {
      const cancelled = vi.fn();
      const controller = new AbortController();
      const stream = new ReadableStream<Uint8Array>({ start() {}, cancel: cancelled });
      const incoming = new Request("http://localhost/api/extract-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, signal: controller.signal, duplex: "half" } as RequestInit);
      const extract = vi.fn().mockResolvedValue(output());
      const response = createExtractionHandler(extract)(incoming);
      if (reason === "caller") controller.abort();
      else await vi.advanceTimersByTimeAsync(20_001);
      expect((await response).status).toBe(reason === "caller" ? 499 : 504);
      expect(cancelled).toHaveBeenCalledOnce();
      expect(extract).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
