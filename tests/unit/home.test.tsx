import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("application shell", () => {
  it("renders without provider configuration and clearly labels the current scope", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('id="main-content"');
    expect(html).toContain("Understand what shapes your shortlist.");
    expect(html).toContain("This is the initial application shell.");
    expect(html).toContain("Not affiliated with Clera.");
    expect(html).toContain("fictional profiles");
  });
});
