import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { EvidenceQuote } from "@/components/dashboard/candidate-detail";

describe("source rendering", () => {
  it("uses exact UTF-16 spans as escaped text and rejects invalid offsets", () => {
    const { role, candidates } = loadDemoFixtures();
    role.sources = [{ id: "source", kind: "job_description", text: 'Before 😀 <script>alert(1)</script> after' }];
    const quote = "<script>alert(1)</script>";
    const start = role.sources[0].text.indexOf(quote);
    const evidence = { sourceId: "source", quote, start, end: start + quote.length };
    const html = renderToStaticMarkup(<EvidenceQuote evidence={evidence} role={role} candidate={candidates[0]} />);
    expect(html).toContain("<mark>&lt;script&gt;alert(1)&lt;/script&gt;</mark>");
    expect(html).not.toContain("<script>");
    expect(renderToStaticMarkup(<EvidenceQuote evidence={{ ...evidence, start: start + 1 }} role={role} candidate={candidates[0]} />)).toContain("Source span unavailable");
  });
});
