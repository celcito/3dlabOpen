import { expect, test } from '@playwright/test';

test('troca de variante + slider angular sem quebrar o preview', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/personalizar-lapis');

  // hex por padrão: grade de 6 faces, sem slider angular, parede ~1.80
  await expect(page.locator('button[title="Face 6"]')).toBeVisible();
  await expect(page.getByText('Posição angular')).toHaveCount(0);
  await expect(page.getByText('1.80 mm', { exact: true }).first()).toBeVisible({ timeout: 60000 });

  // troca para o estojo
  await page.getByRole('button', { name: 'Estojo de Giz de Cera' }).click();
  await expect(page.getByText('Posição angular')).toBeVisible();
  await expect(page.locator('button[title="Face 6"]')).toHaveCount(0);
  await expect(page.getByText('4.00 mm', { exact: true }).first()).toBeVisible({ timeout: 60000 });

  // slider angular grava a posição escolhida
  const angleSlider = page.locator('input[type="range"][max="359"]');
  await expect(angleSlider).toHaveCount(1);
  await angleSlider.evaluate((el) => {
    const input = el as HTMLInputElement;
    // setter nativo: evita o value tracker do React engolir a mudança
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '90');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByText('90°')).toBeVisible();

  // volta para o hex: a grade de faces volta e a parede volta a 1.80
  await page.getByRole('button', { name: 'Lápis Hexagonal' }).click();
  await expect(page.locator('button[title="Face 6"]')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('Posição angular')).toHaveCount(0);
  await expect(page.getByText('1.80 mm', { exact: true }).first()).toBeVisible({ timeout: 60000 });

  expect(pageErrors, `exceções: ${pageErrors.join(' | ')}`).toEqual([]);
  if (consoleErrors.length > 0) console.log('console errors:', consoleErrors);
});
