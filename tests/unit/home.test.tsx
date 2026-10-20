import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("recruiter dashboard", () => {
  it("renders the computed no-key sample and independent fictional-data notice", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('id="main-content"');
    expect(html).toContain("A clearer view of mutual fit.");
    expect(html).toContain("No AI key needed.");
    expect(html).toContain("Demo Birch");
    expect(html).toContain("Role &amp; scenario");
    expect(html).toContain("Not affiliated with Clera.");
    expect(html).toContain("Fictional profiles only");
  });
});
