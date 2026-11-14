import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = __dirname;

async function shot(page, name) {
  const file = path.join(out, name);
  await page.screenshot({ path: file, type: 'png' });
  console.log('ok', name);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.goto('https://peca-ja.expo.app/partner', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await shot(page, 'guia-01-parceiro.png');

await page.getByRole('button', { name: 'Sou comércio' }).click();
await page.waitForURL('**/partner/merchant-apply**', { timeout: 30000 });
await page.waitForTimeout(1200);
await shot(page, 'guia-02-loja.png');

await page.getByPlaceholder('Responsável pela loja').fill('Maria Silva');
await page.getByPlaceholder('loja@email.com').fill('maria@loja.com');
await page.getByPlaceholder('(75) 99999-9999').fill('75999999999');
await page.getByPlaceholder('Ex.: Cantina da Praça').fill('Cantina da Praça');
await page.getByPlaceholder('Rua, número, bairro').fill('Praça da Matriz, 10');

// cidade: open BrazilCityField — try typing Mucugê
const cityBox = page.locator('input').filter({ hasText: '' }).nth(0);
// Prefer placeholder containing Cidade
const cityInput = page.getByPlaceholder(/cidade|Digite|Buscar|Mucugê/i).first();
if (await cityInput.count()) {
  await cityInput.fill('Mucugê');
  await page.waitForTimeout(800);
  const option = page.getByText(/Mucugê/i).first();
  if (await option.count()) await option.click();
} else {
  // Fallback: any textbox near city label
  const inputs = page.locator('input');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const ph = (await inputs.nth(i).getAttribute('placeholder')) || '';
    if (/cidade|mucug|buscar|digite/i.test(ph) || i === 5) {
      await inputs.nth(i).fill('Mucugê');
      await page.waitForTimeout(700);
      const hit = page.locator('text=/Mucugê.*BA|Mucugê/i').first();
      if (await hit.count()) {
        await hit.click().catch(() => {});
      }
      break;
    }
  }
}

await page.waitForTimeout(500);
await shot(page, 'guia-02b-loja-preenchida.png');

await page.getByText('2. Horário').click();
await page.waitForTimeout(1000);
// if still on step 0 due to city validation, try continue button path
if (await page.getByText('Horário de funcionamento').count() === 0) {
  // try selecting city from list more aggressively
  const anyCity = page.locator('input').nth(5);
  await anyCity.click().catch(() => {});
  await anyCity.fill('Mucuge');
  await page.waitForTimeout(1000);
  const sug = page.locator('div,button,li,span').filter({ hasText: /Mucug/i }).first();
  if (await sug.count()) await sug.click();
  await page.getByText('2. Horário').click();
  await page.waitForTimeout(1000);
}
await shot(page, 'guia-03-horario.png');

await page.getByText('3. Pagamento').click();
await page.waitForTimeout(1000);
await shot(page, 'guia-04-pagamento.png');

await page.goto('https://peca-ja.expo.app/partner/plans', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await shot(page, 'guia-05-planos.png');

await page.goto('https://peca-ja.expo.app/partner/pay', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await shot(page, 'guia-06-pagamento-plano.png');

await page.goto('https://peca-ja.expo.app/merchant/menu', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await shot(page, 'guia-07-cardapio.png');

await page.goto('https://peca-ja.expo.app/merchant/orders', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await shot(page, 'guia-08-pedidos.png');

await browser.close();
console.log('done');
