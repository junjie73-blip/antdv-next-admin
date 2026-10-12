import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const PAGES = [
  'index',
  'getting-started',
  'architecture',
  'layout',
  'theming',
  'permissions',
  'mock',
  'development',
  'testing',
  'deploy',
];

const errors = [];
const problems = [];
const note = (m) => problems.push(m);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error')
    errors.push(`[console] ${page.url()} :: ${m.text()}`);
});
page.on('pageerror', (e) =>
  errors.push(`[pageerror] ${page.url()} :: ${e.message}`),
);
page.on('requestfailed', (r) => {
  const u = r.url();
  if (u.startsWith(BASE))
    errors.push(`[requestfailed] ${u} :: ${r.failure()?.errorText}`);
});
const httpErrors = [];
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(BASE))
    httpErrors.push(`${r.status()} ${r.url()}`);
});

// ---------- 1. language chooser at the root ----------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const chooserCards = await page.locator('.VPFeature').count();
const chooserActions = await page.locator('.actions a').count();
console.log(
  `chooser: features=${chooserCards} actions=${chooserActions} lang=${await page.evaluate(() => document.documentElement.lang)}`,
);
if (chooserCards !== 2) note(`chooser features=${chooserCards}, want 2`);
if (chooserActions !== 2)
  note(`chooser hero actions=${chooserActions}, want 2`);
for (const want of ['/zh/', '/en/']) {
  if (
    !(await page
      .locator(`.VPFeature a[href="${want}"], .actions a[href="${want}"]`)
      .count())
  )
    note(`chooser has no link to ${want}`);
}

// ---------- 2. every page in both locales renders ----------
const navProbe = [];
for (const loc of ['zh', 'en']) {
  for (const p of PAGES) {
    const path = p === 'index' ? `/${loc}/` : `/${loc}/${p}`;
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    if (page.url().includes('/404')) {
      note(`${path} resolved to the 404 page`);
      continue;
    }
    const h1 = (
      await page
        .locator('.vp-doc h1')
        .first()
        .textContent()
        .catch(() => null)
    )?.trim();
    const paras = await page.locator('.vp-doc p').count();
    const tables = await page.locator('.vp-doc table').count();
    const code = await page.locator('.vp-doc div[class*=language-]').count();
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    console.log(
      `${path} h1="${h1}" p=${paras} table=${tables} code=${code} lang=${htmlLang}`,
    );
    if (!h1) note(`${path} has no H1`);
    if (paras === 0) note(`${path} renders no paragraph`);
    if (htmlLang !== (loc === 'zh' ? 'zh-CN' : 'en-US'))
      note(`${path} html lang=${htmlLang}`);
    // no untranslated Chinese left on the english side (outside code/UI labels we accept)
    if (loc === 'en' && p === 'layout') navProbe.push(path);
  }
}

// ---------- 3. the language switcher really switches, per page ----------
await page.goto(`${BASE}/zh/layout`, { waitUntil: 'networkidle' });
const navStructure = await page.evaluate(() => {
  const nav = document.querySelector('.VPNavBar');
  const clickable = [...nav.querySelectorAll('button, a')].map((el) => ({
    tag: el.tagName,
    cls: el.className,
    text: (el.textContent ?? '').trim().slice(0, 24),
    href: el.getAttribute('href'),
    aria: el.getAttribute('aria-label'),
  }));
  return {
    hasTranslationsComp: Boolean(nav.querySelector('.VPNavBarTranslations')),
    clickable,
  };
});
console.log('navbar structure:', JSON.stringify(navStructure, null, 1));

async function openLocaleLink(label) {
  // the translations flyout, wherever it lives (desktop popper or the "extra" hamburger)
  const candidates = [
    `.VPNavBarTranslations .text:has-text("${label}")`,
    `.VPNavBar button:has-text("${label}")`,
    `button[aria-label="extra navigation"]`,
  ];
  for (const sel of candidates) {
    const el = page.locator(`.VPNavBar ${sel}`).first();
    if ((await el.count()) === 0) continue;
    await el.click().catch(() => {});
    await page.waitForTimeout(300);
    const link = page
      .locator(
        `.VPMenuLink a:has-text("${label}"), .VPFlyout a:has-text("${label}"), a[href="/en/layout"], a[href="/zh/layout"]`,
      )
      .first();
    if (await link.count()) return link;
  }
  return null;
}

const linkZhToEn = await openLocaleLink('English');
if (linkZhToEn) {
  const href = await linkZhToEn.getAttribute('href');
  console.log(`switcher href from /zh/layout -> ${href}`);
  if (href !== '/en/layout')
    note(`corresponding link is ${href}, expected /en/layout`);
  await linkZhToEn.click();
  await page.waitForLoadState('networkidle');
  console.log(`after click url=${page.url()}`);
  if (!page.url().endsWith('/en/layout'))
    note(`clicking the switcher landed on ${page.url()}`);
  const h1 = (await page.locator('.vp-doc h1').first().textContent())?.trim();
  if (!h1 || !/layout/i.test(h1)) note(`switched page H1 is "${h1}"`);
} else {
  note('no language switcher reachable on /zh/layout');
}

// mobile: the same switcher must be reachable through the hamburger
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/zh/testing`, { waitUntil: 'networkidle' });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
console.log(`mobile 390px horizontal overflow=${overflow}px`);
if (overflow > 2)
  note(`mobile horizontal overflow ${overflow}px on /zh/testing`);
await page
  .locator('button[aria-label="mobile navigation"]')
  .click()
  .catch(() => note('mobile hamburger not found'));
await page.waitForTimeout(400);
const mobileLang = await page
  .locator('.VPNavScreen a, .VPNavScreenTranslations a')
  .filter({ hasText: 'English' })
  .count();
console.log(`mobile language options=${mobileLang}`);
if (mobileLang === 0) note('mobile nav screen offers no English option');
await page.keyboard.press('Escape');

// ---------- 4. anchors in both languages ----------
const anchorChecks = [
  ['/zh/getting-started', '#_3-改了共享包却没生效'],
  ['/zh/layout', '#内容区内边距归布局管'],
  ['/zh/theming', '#用-tailwind-写主题色'],
  ['/zh/deploy', '#type-check-为什么先设成非阻断'],
  [
    '/en/getting-started',
    '#_3-you-changed-a-shared-package-but-nothing-took-effect',
  ],
  ['/en/layout', '#content-area-padding-belongs-to-the-layout'],
  ['/en/theming', '#writing-the-primary-color-with-tailwind'],
  ['/en/deploy', '#why-type-check-is-non-blocking-at-first'],
];
await page.setViewportSize({ width: 1440, height: 900 });
for (const [path, frag] of anchorChecks) {
  await page.goto(`${BASE}${path}${frag}`, { waitUntil: 'networkidle' });
  const id = decodeURIComponent(frag.slice(1));
  const found = await page.locator(`#${CSS.escape(id)}`).count();
  console.log(`anchor ${path}${frag} -> ${found}`);
  if (found === 0) note(`anchor missing: ${path}${frag}`);
}

// every cross-page link inside the docs bodies must resolve to a real page
const seenHrefs = new Set();
for (const loc of ['zh', 'en']) {
  for (const p of PAGES) {
    const path = p === 'index' ? `/${loc}/` : `/${loc}/${p}`;
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('.vp-doc a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('/')),
    );
    for (const h of hrefs) {
      if (seenHrefs.has(`${path} -> ${h}`)) continue;
      seenHrefs.add(`${path} -> ${h}`);
      const clean = h.split('#')[0];
      const ok = PAGES.some(
        (x) =>
          clean === `/${loc}/${x}` || (clean === `/${loc}/` && x === 'index'),
      );
      if (!ok) note(`body link does not match any page: ${path} -> ${h}`);
    }
  }
}
console.log(`body internal links checked=${seenHrefs.size}`);

// ---------- 5. dark mode + local search in both locales ----------
await page.goto(`${BASE}/en/theming`, { waitUntil: 'networkidle' });
const darkBefore = await page.evaluate(() =>
  document.documentElement.classList.contains('dark'),
);
await page.locator('.VPSwitchAppearance').first().click();
await page.waitForTimeout(500);
const darkAfter = await page.evaluate(() =>
  document.documentElement.classList.contains('dark'),
);
console.log(`dark toggle: ${darkBefore} -> ${darkAfter}`);
if (darkBefore === darkAfter)
  note('appearance switch did not change html.dark');

async function searchIn(pagePath, query) {
  await page.goto(`${BASE}${pagePath}`, { waitUntil: 'networkidle' });
  await page
    .locator(
      '.VPNav .VPButton, .VPNav button, .local-search button, .DocSearch, [aria-label="Search"]',
    )
    .first()
    .click();
  await page.waitForTimeout(400);
  const input = page.locator('.VPLocalSearchBox input').first();
  await input.waitFor({ timeout: 5000 });
  await input.fill(query);
  await page.waitForTimeout(900);
  const hits = await page
    .locator('.VPLocalSearchBox .result, .VPLocalSearchBox li')
    .count();
  const labels = await page
    .locator('.VPLocalSearchBox .title')
    .allTextContents();
  console.log(
    `search ${pagePath} "${query}" hits=${hits} first=${JSON.stringify(labels.slice(0, 3))}`,
  );
  await page.keyboard.press('Escape');
  return hits;
}
if ((await searchIn('/zh/', '主题色')) === 0)
  note('zh search "主题色" returned nothing');
if ((await searchIn('/en/', 'primary color')) === 0)
  note('en search "primary color" returned nothing');

// ---------- 6. untranslated Chinese left in the english body ----------
for (const p of PAGES.filter((x) => x !== 'index')) {
  await page.goto(`${BASE}/en/${p}`, { waitUntil: 'networkidle' });
  const zhRuns = await page.evaluate(() => {
    const root = document.querySelector('.vp-doc');
    const text = root.innerText;
    // Chinese only counts in prose, not inside code samples / inline code / labels of literal UI strings
    const stripped = [
      ...root.querySelectorAll('p, li, h1, h2, h3, td, blockquote'),
    ]
      .map((el) => el.textContent)
      .join('\n')
      .replaceAll(/`[^`]*`/g, '');
    return (stripped.match(/[一-鿿]{4,}/g) ?? []).slice(0, 6);
  });
  if (zhRuns.length > 0)
    note(`en/${p} still has Chinese prose: ${JSON.stringify(zhRuns)}`);
}

await browser.close();

console.log('\n=== http >=400 / failed requests ===');
console.log([...new Set([...httpErrors])].join('\n') || '(none)');
console.log('=== console errors ===');
console.log(errors.length > 0 ? [...new Set(errors)].join('\n') : '(none)');
console.log('=== problems ===');
console.log(problems.length > 0 ? problems.join('\n') : '(none)');
const failed = problems.length + errors.length + httpErrors.length;
console.log(
  `RESULT ${failed === 0 ? 'PASS' : 'FAIL'} problems=${problems.length} console=${errors.length} http=${httpErrors.length}`,
);
process.exit(failed === 0 ? 0 : 1);
