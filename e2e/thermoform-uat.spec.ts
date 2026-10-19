import { expect, test } from '@playwright/test';

test('kit termoformado: preset, escala, toggle de peça e export sem erros', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/termoformados');

  // Título + seções do painel
  await expect(page.getByRole('heading', { name: 'Kit Termoformado' })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('01. Forma')).toBeVisible();
  await expect(page.getByText('05. Exportar')).toBeVisible();

  // Readout do layout (coração default) + contagem de peças
  await expect(page.getByText('Layout do kit')).toBeVisible();
  const aside = page.locator('aside');
  const partCount = aside.locator('div.flex:has(> span:text-is("Peças geradas")) span.font-mono').first();
  await expect(page.getByText('Peças geradas')).toBeVisible();
  await expect(partCount).toHaveText('4', { timeout: 60000 });

  // Troca de preset re-renderiza sem exceção
  await page.getByRole('button', { name: 'Morango' }).click();
  await expect(page.getByRole('button', { name: 'Morango' })).toHaveClass(/border-\[#632CE5\]/);

  // Escala: muda o tamanho e o readout do layout reage
  const layoutValue = aside.locator('span.font-mono.font-black').first();
  const before = await layoutValue.innerText();
  const sizeSlider = page.locator('input[type="range"]').first();
  await sizeSlider.evaluate((el) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '80');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => layoutValue.innerText(), { timeout: 60000 }).not.toBe(before);

  // Toggle "Encaixes": partCount 4 → 3
  await page.getByRole('button', { name: 'Encaixes' }).click();
  await expect(partCount).toHaveText('3', { timeout: 60000 });

  expect(pageErrors, `exceções: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('regressão: rotas /porta-canetas, /chaveiro e /medalha carregam sem exceção', async ({ page }) => {
  for (const route of ['/porta-canetas', '/chaveiro', '/medalha']) {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 60000 });
    expect(pageErrors, `${route}: ${pageErrors.join(' | ')}`).toEqual([]);
  }
});
