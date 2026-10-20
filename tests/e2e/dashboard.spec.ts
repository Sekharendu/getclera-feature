import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import expectations from "../../src/data/demo-expectations.json" with { type: "json" };

const key = "clera-match-explorer.state.v1";
async function ready(page: Page) { await page.goto("/"); await expect(page.getByRole("button", { name: "Load fictional sample" })).toBeEnabled(); }
async function openEditor(page: Page, id: string) {
  const editor = page.getByTestId(id);
  if ((await editor.getAttribute("open")) === null) await editor.locator("summary").click();
  return editor;
}
async function remote(page: Page) {
  const editor = await openEditor(page, "role-work-mode");
  await editor.getByLabel("remote", { exact: true }).check();
  await expect(editor.getByLabel("office", { exact: true })).toBeChecked();
  await editor.getByRole("button", { name: "Apply requirement" }).click();
}
async function counts(page: Page) { return Promise.all(["eligible", "needs_clarification", "blocked"].map((status) => page.getByTestId(`count-${status}`).innerText())); }

test("core mutual-fit story, exact evidence, keyboard dialog, persistence and reset", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator(".candidate-card")).toHaveCount(25);
  const baseline = await counts(page);
  for (const status of ["eligible", "needs_clarification", "blocked"]) await expect(page.getByTestId(`count-${status}`)).toHaveText(`${expectations.filter((e) => e.eligibility === status).length}/ 25`);
  mkdirSync("artifacts/t07", { recursive: true });
  await page.screenshot({ path: `artifacts/t07/${info.project.name}-dashboard.png` });
  await page.locator(".summary-grid").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/t07/${info.project.name}-results.png` });
  const opener = page.getByTestId("candidate-02").getByRole("button");
  await opener.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Demo Birch" });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close details" });
  await expect(close).toBeFocused();
  await expect(dialog.getByRole("heading", { name: "Employer requirements" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Candidate preferences" })).toBeVisible();
  await expect(dialog.locator("mark").filter({ hasText: "Work policy: office only." }).first()).toHaveText("Work policy: office only.");
  await page.screenshot({ path: `artifacts/t07/${info.project.name}-detail.png` });
  await page.keyboard.press("Shift+Tab"); await expect(dialog.getByRole("button", { name: "Return to shortlist" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
  await remote(page);
  await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Eligible");
  await expect(page.getByTestId("candidate-15").locator(".badge")).toHaveText("Blocked");
  await page.getByTestId("candidate-02").getByRole("button").click();
  await expect(page.getByRole("dialog").getByText("Manual requirement · no source quote for this value")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Changed in scenario/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("candidate-15").getByRole("button").click();
  await expect(page.getByRole("dialog").getByText("The salary ranges do not overlap.").first()).toBeVisible();
  await page.keyboard.press("Escape");
  const changed = await counts(page); await page.reload();
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Restored"); expect(await counts(page)).toEqual(changed);
  await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Eligible");
  await page.getByRole("button", { name: "Reset scenario" }).click(); expect(await counts(page)).toEqual(baseline);
  await page.reload(); await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Restored"); expect(await counts(page)).toEqual(baseline);
  await remote(page);
  await page.getByRole("button", { name: "Clear local data" }).click();
  expect(await counts(page)).toEqual(baseline);
  await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Blocked");
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  expect(errors).toEqual([]);
});

test("typed controls retain invalid drafts and preserve results; filters and unknown questions", async ({ page }) => {
  await ready(page); const initial = await counts(page);
  const salary = await openEditor(page, "role-salary");
  await salary.getByLabel("Minimum", { exact: true }).fill("999999"); await salary.getByRole("button", { name: "Apply requirement" }).click();
  await expect(salary.getByRole("alert")).toBeVisible(); await expect(salary.getByLabel("Minimum", { exact: true })).toHaveValue("999999"); expect(await counts(page)).toEqual(initial);
  await salary.getByLabel("Minimum", { exact: true }).fill("100000"); await salary.getByLabel("Currency", { exact: true }).fill("USD"); await salary.getByRole("button", { name: "Apply requirement" }).click();
  const saved = async () => JSON.parse((await page.evaluate((storageKey) => localStorage.getItem(storageKey), key))!);
  expect((await saved()).scenario.overrides.find((p: { constraintId: string }) => p.constraintId === "role-salary").value.min).toBe(100000);
  const skill = await openEditor(page, "role-skill-typescript"); const priorSkill = await counts(page);
  await skill.getByLabel("Canonical skill ID").fill(""); await skill.getByRole("button", { name: "Apply requirement" }).click(); await expect(skill.getByRole("alert")).toBeVisible(); expect(await counts(page)).toEqual(priorSkill);
  await skill.getByLabel("Canonical skill ID").fill("typescript"); await skill.getByRole("button", { name: "Apply requirement" }).click();
  const date = await openEditor(page, "role-latest-start");
  await date.getByLabel("Date (YYYY-MM-DD)").fill("2027-02-30"); await date.getByRole("button", { name: "Apply requirement" }).click(); await expect(date.getByRole("alert")).toBeVisible();
  await date.getByLabel("Date (YYYY-MM-DD)").fill("2027-02-01"); await date.getByRole("button", { name: "Apply requirement" }).click();
  const location = await openEditor(page, "role-location"); await location.getByLabel("Location IDs, comma separated").fill("us-san-francisco,us-new-york"); await location.getByRole("button", { name: "Apply requirement" }).click();
  const skillAgain = await openEditor(page, "role-skill-typescript"); await skillAgain.getByLabel("Importance").selectOption("preferred"); await skillAgain.getByLabel("Enabled", { exact: true }).uncheck();
  expect((await saved()).scenario.overrides.find((p: { constraintId: string }) => p.constraintId === "role-skill-typescript")).toMatchObject({ importance: "preferred", enabled: false });
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await page.getByLabel("Search candidates").fill("does not exist"); await expect(page.getByText("No candidates match these filters.")).toBeVisible(); await page.getByRole("button", { name: "Clear filters" }).click(); await expect(page.locator(".candidate-card")).toHaveCount(25);
  await page.getByLabel("Filter eligibility").selectOption("eligible"); await expect(page.locator(".candidate-card .badge")).toHaveText(Array(expectations.filter((e) => e.eligibility === "eligible").length).fill("Eligible"));
  await page.getByLabel("Filter eligibility").selectOption("all");
  await page.getByTestId("candidate-16").getByRole("button").click();
  for (const name of ["Employer requirements", "Candidate preferences"]) {
    const section = page.getByRole("dialog").locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(section.getByText(/What are the annual base salary budget/)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("corrupt or unsupported saved state recovers visibly; unavailable storage keeps demo usable", async ({ page }) => {
  await page.addInitScript((storageKey) => { if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, '{"schemaVersion":99}'); }, key);
  await ready(page); await expect(page.getByRole("status", { name: "Local save status" })).toContainText("unsupported version"); await expect(page.locator(".candidate-card")).toHaveCount(25);
  await page.getByRole("button", { name: "Clear local data" }).click();
  await page.evaluate((storageKey) => localStorage.setItem(storageKey, "{"), key); await page.reload();
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText("could not be read");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error("quota"); }; });
  await remote(page); await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Could not save locally"); await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Eligible");
});

test("stale saved roles survive recovery, open salary bounds apply, and denied reads preserve demo", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Load fictional sample" }).click();
  await page.evaluate((storageKey) => {
    const saved = JSON.parse(localStorage.getItem(storageKey)!);
    saved.role.title = "Retained saved role";
    saved.role.revision += 1;
    localStorage.setItem(storageKey, JSON.stringify(saved));
  }, key);
  await page.reload();
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Saved scenario is stale");
  await expect(page.locator(".role-title")).toHaveText("Retained saved role");
  await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Blocked");
  const salary = await openEditor(page, "role-salary");
  await salary.getByLabel("No lower bound", { exact: true }).check();
  await salary.getByLabel("No upper bound", { exact: true }).check();
  await salary.getByRole("button", { name: "Apply requirement" }).click();
  await expect(salary.getByRole("alert")).toHaveCount(0);
  const patch = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).scenario.overrides.find((item: { constraintId: string }) => item.constraintId === "role-salary"), key);
  expect(patch.value).toMatchObject({ min: null, max: null, minExplicitlyUnbounded: true, maxExplicitlyUnbounded: true });
  const skill = await openEditor(page, "role-skill-typescript");
  await skill.getByLabel("Canonical skill ID").fill("");
  await skill.getByRole("button", { name: "Apply requirement" }).click();
  await expect(skill.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Reset scenario" }).click();
  const resetSkill = await openEditor(page, "role-skill-typescript");
  await expect(resetSkill.getByLabel("Canonical skill ID")).toHaveValue("typescript");
  await expect(resetSkill.getByRole("alert")).toHaveCount(0);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
  });
  await page.reload();
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Browser storage is unavailable");
  await expect(page.locator(".candidate-card")).toHaveCount(25);
  await remote(page);
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText("Could not save locally");
  await expect(page.getByTestId("candidate-02").locator(".badge")).toHaveText("Eligible");
});
