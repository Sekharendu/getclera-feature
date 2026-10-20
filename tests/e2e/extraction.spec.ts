import { test, expect } from "@playwright/test";

test("real Gemini route validates before no-Gemini-config503 despite legacy-only variables", async ({ request, page }) => {
  for (const body of [{ text: "" }, { text: "hello", extra: true }]) expect((await request.post("/api/extract-role", { data: body })).status()).toBe(400);
  expect((await request.post("/api/extract-role", { data: "{", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/extract-role", { data: { text: "x".repeat(20001) } })).status()).toBe(413);
  expect((await request.post("/api/extract-role", { data: " ".repeat(128 * 1024 + 1), headers: { "Content-Type": "application/json" } })).status()).toBe(413);
  const unavailable = await request.post("/api/extract-role", { data: { text: "Must have TypeScript skills." } });
  expect(unavailable.status()).toBe(503); expect((await unavailable.json()).error.code).toBe("not_configured"); expect(unavailable.headers()["cache-control"]).toBe("no-store");
  expect((await request.get("/api/extract-role")).status()).toBe(405);
  await page.goto("/"); await expect(page.locator(".candidate-card")).toHaveCount(25); await expect(page.getByText(/Requesting extraction sends pasted text/)).toBeVisible();
  await expect(page.locator("footer")).toContainText("Google Gemini");
  await expect(page.locator("footer")).not.toContainText("OpenAI");
});
