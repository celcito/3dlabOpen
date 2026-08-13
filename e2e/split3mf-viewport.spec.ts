import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(__dirname, "fixtures", name);

async function dismissOnboarding(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Entendi" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("Split 3MF loads a visible and manipulable viewport", async ({ page }) => {
  await page.goto("/split-3mf");
  await dismissOnboarding(page);

  await page.locator('input[type="file"]').setInputFiles(fixture("plain-cube.obj"));
  await expect(page.getByText("PLAIN-CUBE.OBJ", { exact: false }).first()).toBeVisible();

  const viewport = page.getByTestId("split3mf-viewport");
  const canvas = viewport.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(400);
  expect(box?.height ?? 0).toBeGreaterThan(300);

  const before = await viewport.screenshot();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 100, centerY + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await viewport.screenshot();
  expect(after.equals(before)).toBe(false);

  await page.getByTitle("Fronteira").click();
  await page.getByRole("button", { name: "+ Nova região" }).click();
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - 40, centerY + 20, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText(/% pintado/)).not.toContainText("0% pintado");
});
