import { test, expect, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import originalRole from "../../src/data/demo-role.json" with { type: "json" };

const key = "clera-match-explorer.state.v1";
const sourceText = originalRole.sources[0].text;
function success(text = sourceText, title = originalRole.title) {
  const role = structuredClone(originalRole);
  role.title = title; role.sources[0].text = text;
  role.constraints.forEach((constraint) => { constraint.requirement.origin = "extracted"; });
  return { draftRole: role, warnings: [{ code: "review_required", message: "Review every proposed requirement before confirming." }] };
}
async function ready(page: Page) { await page.goto("/"); await expect(page.getByRole("button", { name: "Load fictional sample" })).toBeEnabled(); }
async function saved(page: Page) { return page.evaluate((storageKey) => localStorage.getItem(storageKey), key); }
async function counts(page: Page) { return page.locator(".summary-card strong").allTextContents(); }

test("review is isolated, invalid fields block confirmation, explicit confirm revisions and resets atomically", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const mode = page.getByTestId("role-work-mode"); await mode.locator("summary").click(); await mode.getByLabel("remote", { exact: true }).check(); await mode.getByRole("button", { name: "Apply requirement" }).click();
  const oldSaved = await saved(page); const oldCounts = await counts(page);
  await page.route("**/api/extract-role", async (route) => { expect(route.request().postDataJSON()).toEqual({ text: sourceText }); await route.fulfill({ json: success() }); });
  await page.getByLabel("Job description", { exact: true }).fill(sourceText); await page.getByRole("button", { name: "Extract role", exact: true }).click();
  const review = page.getByRole("region", { name: "Review proposed requirements" }); await expect(review).toBeVisible();
  expect(await saved(page)).toBe(oldSaved); expect(await counts(page)).toEqual(oldCounts);
  await expect(review.getByText("Review every proposed requirement before confirming.")).toBeVisible();
  await expect(review.locator("mark").filter({ hasText: "Work policy: office only." })).toHaveText("Work policy: office only.");
  const skill = review.getByTestId("role-skill-typescript"); await skill.locator("summary").click();
  await skill.getByLabel("Canonical skill ID").fill(""); await skill.getByRole("button", { name: "Apply requirement" }).click(); await expect(skill.getByRole("alert")).toBeVisible(); await expect(review.getByRole("button", { name: "Confirm role" })).toBeDisabled();
  await skill.getByLabel("Importance").selectOption("preferred"); await expect(review.getByRole("button", { name: "Confirm role" })).toBeDisabled();
  await skill.getByLabel("Canonical skill ID").fill("python"); await skill.getByRole("button", { name: "Apply requirement" }).click();
  await expect(review.getByText(/Importance edited by recruiter/).first()).toBeVisible();
  await review.getByLabel("Draft role title").fill("Reviewed engineering role"); await expect(review.getByRole("button", { name: "Confirm role" })).toBeDisabled(); await review.getByRole("button", { name: "Apply title" }).click(); await expect(review.getByText("Manual title correction")).toBeVisible();
  expect(await saved(page)).toBe(oldSaved); expect(await counts(page)).toEqual(oldCounts);
  mkdirSync("artifacts/t09", { recursive: true }); await review.scrollIntoViewIfNeeded(); await page.screenshot({ path: `artifacts/t09/${info.project.name}-review.png` });
  await review.getByRole("button", { name: "Confirm role" }).focus(); await page.keyboard.press("Enter");
  await expect(review).not.toBeVisible(); await expect(page.getByText("Confirmed baseline · revision 2")).toBeVisible();
  const confirmed = JSON.parse((await saved(page))!); expect(confirmed.role).toMatchObject({ title: "Reviewed engineering role", revision: 2 }); expect(confirmed.scenario.overrides).toEqual([]); expect(confirmed.scenario.baselineRevision).toBe(2);
  expect(confirmed.role.constraints[0].requirement).toEqual({ value: "python", origin: "manual", evidence: [] }); expect(confirmed.role.constraints[0].importance).toBe("preferred");
  await page.reload(); await expect(page.getByText("Confirmed baseline · revision 2")).toBeVisible(); await expect(page.getByText("Reviewed engineering role", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset scenario" }).click(); expect(JSON.parse((await saved(page))!).role.title).toBe("Reviewed engineering role");
  await page.getByRole("button", { name: "Load fictional sample" }).click(); await expect(page.getByText("Confirmed baseline · revision 1")).toBeVisible();
  expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("actual no-key and mocked failures preserve pasted text, baseline, scenario and local state", async ({ page }) => {
  await ready(page); await page.getByRole("button", { name: "Load fictional sample" }).click();
  const before = await saved(page); const baseline = await counts(page);
  const input = page.getByLabel("Job description", { exact: true }); await input.fill(sourceText);
  const submit = page.getByRole("button", { name: "Extract role", exact: true }); const status = page.getByRole("status", { name: "Extraction status" });
  await submit.click(); await expect(status).toContainText("not configured"); await expect(input).toHaveValue(sourceText);
  for (const kind of ["502", "504", "malformed", "network"]) {
    await page.route("**/api/extract-role", (route) => kind === "network" ? route.abort("failed") : kind === "malformed" ? route.fulfill({ json: { bad: "raw provider secret" } }) : route.fulfill({ status: Number(kind), json: { error: { message: "raw provider secret" } } }));
    await submit.click(); await expect(status).toContainText(/preserved/); await expect(status).not.toContainText("raw provider secret"); await expect(input).toHaveValue(sourceText); expect(await saved(page)).toBe(before); expect(await counts(page)).toEqual(baseline);
    await page.unroute("**/api/extract-role");
  }
  await input.fill(" "); await expect(submit).toBeDisabled(); await input.fill("x".repeat(20001)); await expect(submit).toBeDisabled();
});

test("generation guards survive ignored abort: edits, newer success, cancel, sample and clear", async ({ page }) => {
  await page.addInitScript(() => { const actual = window.fetch.bind(window); window.fetch = (input, init) => actual(input, { ...init, signal: undefined }); });
  await ready(page);
  const held: Route[] = []; let hold = true;
  await page.route("**/api/extract-role", async (route) => { if (hold) held.push(route); else await route.fulfill({ json: success(route.request().postDataJSON().text, "Newer proposed role") }); });
  const input = page.getByLabel("Job description", { exact: true }); const submit = page.getByRole("button", { name: "Extract role", exact: true });
  await input.fill(sourceText); await submit.click(); await expect.poll(() => held.length).toBe(1);
  await input.fill(sourceText + "\nNew version."); hold = false; await submit.click(); await expect(page.getByLabel("Draft role title")).toHaveValue("Newer proposed role");
  await held[0].fulfill({ json: success(sourceText, "Stale proposed role") }); await page.waitForLoadState("networkidle"); await expect(page.getByLabel("Draft role title")).toHaveValue("Newer proposed role");
  await input.fill(sourceText); await expect(page.getByRole("button", { name: "Confirm role" })).toHaveCount(0);
  hold = true;
  for (const action of ["Cancel extraction", "Load fictional sample", "Clear local data"]) {
    const index = held.length; await input.fill(sourceText); await submit.click(); await expect.poll(() => held.length).toBe(index + 1); await page.getByRole("button", { name: action, exact: true }).click();
    await held[index].fulfill({ json: success() }); await page.waitForLoadState("networkidle"); await expect(page.getByRole("button", { name: "Confirm role" })).toHaveCount(0); await expect(page.getByText("Confirmed baseline · revision 1")).toBeVisible();
  }
  expect(await saved(page)).toBeNull();
});
