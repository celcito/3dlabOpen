import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = (name: string) => join(__dirname, "fixtures", name);

async function dismissOnboarding(page: import("@playwright/test").Page) {
  const gotIt = page.getByRole("button", { name: "Entendi" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function uploadFile(page: import("@playwright/test").Page, path: string) {
  await page.locator('input[type="file"]').setInputFiles(path);
}

function exportButton(page: import("@playwright/test").Page) {
  // The real export trigger is the green filled button (SplitExportBar);
  // tab buttons carry a `title` so they are disambiguated by absence of it.
  return page.locator("button.bg-\\[\\#00C853\\]");
}

test.describe("Split3MF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/split-3mf");
    await dismissOnboarding(page);
  });

  test("scenario 1: painted 3MF → auto-segment → export 3MF", async ({ page }) => {
    await uploadFile(page, fixtures("painted-cube.3mf"));
    await expect(page.getByText("Regiões detectadas automaticamente.")).toBeVisible();
    await expect(page.getByText(/% pintado/)).toBeVisible();
    await expect(page.getByText(/% pintado/)).toContainText("2 regiões");

    // Cap tab → soap_film (default), pick it explicitly.
    await page.getByTitle("Fecho").click();
    await page.getByRole("button", { name: "Película" }).click();

    // Export tab → 3MF.
    await page.getByTitle("Exportar").click();
    await page.getByRole("button", { name: "3MF" }).click();
    const downloadPromise = page.waitForEvent("download");
    await exportButton(page).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("split.3mf");
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
  });

  test("scenario 2: OBJ without groups → manual boundary → export OBJ", async ({ page }) => {
    await uploadFile(page, fixtures("plain-cube.obj"));
    await expect(page.getByText("OBJ sem grupos detectados")).toBeVisible();

    // Create a region and paint it with the brush over the cube.
    await page.getByTitle("Fronteira").click();
    await page.getByRole("button", { name: "+ Nova região" }).click();
    await expect(page.getByText("Região 1")).toBeVisible();

    const canvas = page.locator("canvas").first();
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(cx - 20 + i * 4, cy + Math.sin(i / 2) * 12);
    }
    await page.mouse.up();

    // Stats overlay must show non-zero painted percent.
    await expect
      .poll(
        async () => {
          const t = await page.getByText(/% pintado/).textContent();
          return t ?? "";
        },
        { timeout: 20000 }
      )
      .toMatch(/regi[oõ]es · (?!0%)\d+% pintado/);

    // Export tab → OBJ (delivered as zip with .mtl files).
    await page.getByTitle("Exportar").click();
    await page.getByRole("button", { name: "OBJ" }).click();
    const downloadPromise = page.waitForEvent("download");
    await exportButton(page).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("split.zip");
  });

  test("scenario 3: GLB → cap soap_film → export STL", async ({ page }) => {
    await uploadFile(page, fixtures("colored-cube.glb"));
    await expect(page.getByText("Regiões detectadas automaticamente.")).toBeVisible();
    await expect(page.getByText(/% pintado/)).toBeVisible();

    await page.getByTitle("Fecho").click();
    await page.getByRole("button", { name: "Película" }).click();

    await page.getByTitle("Exportar").click();
    await page.getByRole("button", { name: "STL" }).click();
    const downloadPromise = page.waitForEvent("download");
    await exportButton(page).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("split.stl");
  });
});