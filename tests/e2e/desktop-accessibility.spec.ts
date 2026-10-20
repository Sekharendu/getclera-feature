import { test, expect, type Locator } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

async function colorSample(locator: Locator, name: string) {
  const measured = await locator.evaluate((element) => {
    type Color = [number, number, number, number];
    const color = (value: string): Color => { const parts = value.match(/[\d.]+/g)?.map(Number) ?? []; return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]; };
    const blend = (top: Color, bottom: Color): Color => [top[0] * top[3] + bottom[0] * (1 - top[3]), top[1] * top[3] + bottom[1] * (1 - top[3]), top[2] * top[3] + bottom[2] * (1 - top[3]), 1];
    const luminance = (value: Color) => value.slice(0, 3).map((channel) => { const linear = channel / 255; return linear <= .04045 ? linear / 12.92 : ((linear + .055) / 1.055) ** 2.4; }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const ratio = (a: Color, b: Color) => { const first = luminance(a); const second = luminance(b); return (Math.max(first, second) + .05) / (Math.min(first, second) + .05); };
    const chain: Element[] = []; for (let current: Element | null = element; current; current = current.parentElement) chain.unshift(current);
    let background: Color = [255, 255, 255, 1]; let parentBackground = background;
    for (const current of chain) { parentBackground = background; background = blend(color(getComputedStyle(current).backgroundColor), background); }
    const style = getComputedStyle(element); const foreground = blend(color(style.color), background);
    const fontSize = parseFloat(style.fontSize); const large = fontSize >= 24 || (fontSize >= 18.66 && parseFloat(style.fontWeight) >= 700);
    const outline = color(style.outlineColor);
    return { foreground: style.color, background: background.slice(0, 3), ratio: ratio(foreground, background), target: large ? 3 : 4.5, fontSize, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineRatio: Math.min(ratio(blend(outline, parentBackground), parentBackground), ratio(blend(outline, background), background)), opacity: chain.reduce((value, current) => value * Number(getComputedStyle(current).opacity), 1) };
  });
  return { name, ...measured };
}

test("desktop representative contrast, textarea focus and keyboard skip link", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop delivery scope; existing mobile tests retained separately.");
  await page.goto("/"); await expect(page.getByRole("button", { name: "Load fictional sample" })).toBeEnabled();
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(/#main-content$/);
  const samples: Awaited<ReturnType<typeof colorSample>>[] = [];
  for (const [name, selector] of [["heading", "h1"], ["muted copy", ".page-heading .muted"], ["small status", ".save-status"], ["ranking note", ".ranking-note"], ["candidate caption", ".candidate-card .tiny"], ["avatar", ".avatar"], ["stat label", ".candidate-stats span"], ["detail link", ".detail-button"], ["eligible badge", ".candidate-card .badge.eligible"], ["blocked badge", ".candidate-card .badge.blocked"], ["clarification badge", ".candidate-card .badge.needs_clarification"], ["footer", "footer"]]) samples.push(await colorSample(page.locator(selector).first(), name));
  const input = page.getByLabel("Job description", { exact: true }); await input.fill("A role to review."); await input.focus();
  const focus = await colorSample(input, "textarea focus"); samples.push(focus);
  samples.push(await colorSample(page.getByRole("button", { name: "Extract role", exact: true }), "primary button"));
  const salary = page.getByTestId("role-salary"); await salary.locator("summary").click(); await salary.getByLabel("Minimum", { exact: true }).fill("999999"); await salary.getByRole("button", { name: "Apply requirement" }).click(); samples.push(await colorSample(salary.getByRole("alert"), "validation error"));
  await page.getByTestId("candidate-16").getByRole("button").click();
  for (const [name, selector] of [["source label", ".source-label"], ["source context", ".evidence p"], ["source mark", "mark"], ["passed badge", ".badge.pass"], ["failed badge", ".badge.fail"], ["unknown badge", ".badge.unknown"], ["clarification question", ".question"], ["detail fine print", ".fine-print"]]) samples.push(await colorSample(page.getByRole("dialog").locator(selector).first(), name));
  await page.keyboard.press("Escape"); await expect(page.getByTestId("candidate-16").getByRole("button")).toBeFocused();
  mkdirSync("artifacts/t11", { recursive: true });
  writeFileSync("artifacts/t11/contrast.json", JSON.stringify({ generatedAt: new Date().toISOString(), samples, scope: "Representative desktop computed styles; ancestor alpha backgrounds composited; sampled ancestor opacity must be1. No exhaustive WCAG claim." }, null, 2) + "\n");
  await page.locator(".summary-grid").scrollIntoViewIfNeeded(); await page.screenshot({ path: "artifacts/t11/desktop-final.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(samples.filter((sample) => sample.opacity !== 1 || sample.ratio < sample.target).map((sample) => ({ name: sample.name, ratio: sample.ratio, target: sample.target }))).toEqual([]);
  expect(focus.outlineStyle).toBe("solid"); expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2); expect(focus.outlineRatio).toBeGreaterThanOrEqual(3);
});
