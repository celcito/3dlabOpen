import { test, expect } from "@playwright/test";

test("legacy slicer renders its viewport", async ({ page }) => {
  await page.goto("/viewer3d");
  const demo = page.getByRole("button", { name: "Load Demo Model" });
  await expect(demo).toBeVisible();
  await demo.click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/opencode/legacy-slicer-viewport.png", fullPage: true });
});
