import { chromium } from 'playwright';

const BASE = 'http://localhost:6080';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function signIn() {
  await page.goto(`${BASE}/#/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { exact: true, name: '登录' }).click();
  await page.locator('.tab-item').first().waitFor({ timeout: 30_000 });
}

async function go(path) {
  await page.evaluate((p) => { window.location.hash = `#${p}`; }, path);
  await page.waitForTimeout(2500);
}

const dump = (label, fn) => page.evaluate(fn).then((r) => console.log(`\n===== ${label}\n${typeof r === 'string' ? r : JSON.stringify(r, null, 1)}`));

await signIn();

await go('/system/user');
await dump('user: switch/tree/upload hooks', () => {
  const hooks = ['data-common-tree-node', 'data-common-tag', 'data-slot="switch"', 'data-common-image-preview'];
  return hooks.map((h) => `${h} => ${document.querySelectorAll(`[${h.replace(/"/g, '')}]`).length}`).join('\n');
});
await dump('user: row outerHTML (first)', () => document.querySelector('tr.basic-table-row')?.outerHTML?.slice(0, 600));
await dump('user: row computed cursor + class', () => {
  const tr = document.querySelector('tr.basic-table-row');
  return { cls: tr?.className, cursor: getComputedStyle(tr).cursor, role: tr?.getAttribute('role') };
});
await dump('user: breadcrumb page span', () => {
  const el = document.querySelector('[role="link"][aria-current="page"]');
  return el ? { tag: el.tagName, cls: el.className, cursor: getComputedStyle(el).cursor, aria: el.outerHTML.slice(0, 200) } : null;
});
await dump('user: link buttons', () => {
  const b = document.querySelector('button[data-slot="button"][data-variant="link"]');
  return b ? { n: document.querySelectorAll('button[data-variant="link"]').length, cursor: getComputedStyle(b).cursor, html: b.outerHTML.slice(0, 200) } : null;
});
await dump('user: menu item active span', () => {
  const els = [...document.querySelectorAll('[aria-current="page"]')].map((el) => ({
    tag: el.tagName, cls: (el.className || '').toString().slice(0, 120), role: el.getAttribute('role'),
    cursor: getComputedStyle(el).cursor, text: (el.textContent || '').trim().slice(0, 20),
  }));
  return els;
});
await dump('user: pagination + select hooks', () => ({
  paginationNext: !!document.querySelector('[data-slot="pagination-next"]'),
  spin: !!document.querySelector('[role="spinbutton"]'),
}));

await go('/system/dept');
await dump('dept: tree nodes', () => {
  const nodes = [...document.querySelectorAll('[data-common-tree-node]')];
  return { count: nodes.length, first: nodes[0]?.outerHTML?.slice(0, 400), cursor: nodes[0] ? getComputedStyle(nodes[0]).cursor : null, hiddenMeasure: document.querySelectorAll('[aria-hidden="true"]').length };
});

await go('/system/menu');
await dump('menu: row depth indent spans', () => {
  const rows = [...document.querySelectorAll('tr.basic-table-row')];
  return rows.slice(0, 6).map((r) => ({
    key: r.getAttribute('data-row-key'),
    spans: [...r.querySelectorAll('td span')].map((s) => s.getAttribute('style')).filter(Boolean),
    switches: r.querySelectorAll('[data-slot="switch"]').length,
    tags: r.querySelectorAll('[data-common-tag]').length,
  }));
});
await dump('menu: switch attrs', () => {
  const s = document.querySelector('tr.basic-table-row [data-slot="switch"]');
  return s ? { outer: s.outerHTML.slice(0, 300), cursor: getComputedStyle(s).cursor } : null;
});

await go('/components/upload');
await dump('upload: structure', () => {
  const root = document.querySelector('[data-common-upload]');
  return { roots: document.querySelectorAll('[data-common-upload]').length, first: root?.outerHTML?.slice(0, 900) };
});
await dump('upload: cards', () => [...document.querySelectorAll('[data-slot="card"]')].map((c) => c.querySelector('[data-slot="card-title"]')?.textContent?.trim()).slice(0, 12));
await dump('upload: svg icons present (iconify network)', () => document.querySelectorAll('svg').length);

await go('/dashboard/analysis');
await dump('analysis: segmented', () => {
  const seg = document.querySelector('[data-common-segmented]');
  return seg ? { html: seg.outerHTML.slice(0, 500), items: seg.querySelectorAll('[data-slot="toggle-group-item"]').length, cursor: getComputedStyle(seg.querySelector('[data-slot="toggle-group-item"]')).cursor } : null;
});
await dump('analysis: radio hooks', () => document.querySelectorAll('[role="radio"]').length);

await go('/components/form/basic');
await dump('form basic: rate', () => {
  const r = document.querySelector('[role="radiogroup"]');
  return { radios: document.querySelectorAll('div[role="radio"]').length, rg: r ? r.outerHTML.slice(0, 400) : null, stars: [...document.querySelectorAll('[class*=rate]')].length };
});

await browser.close();
