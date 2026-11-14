import { chromium, firefox, webkit } from '@playwright/test';
const ENGINE = process.env.ENGINE || 'firefox';
const browsers = { chromium, firefox, webkit };

const BASE = 'http://localhost:6080';

async function run() {
  const browser = await browsers[ENGINE].launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) =>
    console.log('PAGEERROR', String(e.message).slice(0, 120)),
  );

  await page.goto(`${BASE}/#/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { exact: true, name: '登录' }).click();
  await page.locator('.tab-item').first().waitFor({ timeout: 30_000 });

  await page.evaluate(() => {
    window.location.hash = '#/enterprise/im';
  });
  await page.waitForTimeout(4000);

  // 记录每一次滚动后的几何快照，用来判断 restoreTopAnchor 有没有落地
  await page.evaluate(() => {
    window.__trace = [];
    const vp = document.querySelector(
      '[data-slot="im-message-pane"] [data-slot="scroll-area-viewport"]',
    );
    window.__vp = vp;
    vp.addEventListener(
      'scroll',
      () => {
        window.__trace.push({
          top: Math.round(vp.scrollTop),
          height: Math.round(vp.scrollHeight),
          client: Math.round(vp.clientHeight),
          idx: [...vp.querySelectorAll('[data-index]')]
            .map((el) => el.dataset.index)
            .join(','),
        });
      },
      { passive: true },
    );
  });

  const geo = () =>
    page.evaluate(() => {
      const vp = window.__vp;
      const list = vp.querySelector('[data-message-list]');
      return {
        top: Math.round(vp.scrollTop),
        height: Math.round(vp.scrollHeight),
        client: Math.round(vp.clientHeight),
        mode: list?.dataset.messageList,
        total: list?.dataset.totalSize,
        firstIdx: [...vp.querySelectorAll('[data-index]')]
          .map((el) => Number(el.dataset.index))
          .slice(0, 3),
        lastIdx: [...vp.querySelectorAll('[data-index]')]
          .map((el) => Number(el.dataset.index))
          .slice(-3),
        rowCount: vp.querySelectorAll('[data-index]').length,
        has281: vp.textContent.includes('第 281 条'),
        has400: vp.textContent.includes('第 400 条'),
      };
    });

  await page.waitForFunction(
    () => {
      const vp = window.__vp;
      return vp && vp.scrollHeight - vp.scrollTop - vp.clientHeight <= 40;
    },
    null,
    { timeout: 15_000 },
  );
  console.log('贴底后', JSON.stringify(await geo()));

  await page
    .locator('[data-slot="im-message-pane"] [data-slot="scroll-area-viewport"]')
    .hover();
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(60);
  }
  console.log('滚到顶', JSON.stringify(await geo()));

  await page
    .waitForFunction(
      () => {
        const b = [...document.querySelectorAll('[data-slot="badge"]')].find(
          (x) => x.textContent.includes('条'),
        );
        return b && b.textContent.includes('150');
      },
      null,
      { timeout: 20_000 },
    )
    .catch(() => console.log('!! 150 徽章没等到'));

  console.log('合并后立刻', JSON.stringify(await geo()));
  await page.waitForTimeout(1500);
  console.log('合并后 1.5s', JSON.stringify(await geo()));
  const trace = await page.evaluate(() => window.__trace.slice(-14));
  console.log('滚动轨迹尾部:');
  for (const t of trace)
    console.log(
      `  top=${t.top} height=${t.height} client=${t.client} idx=${t.idx}`,
    );

  await browser.close();
}

run().catch((error) => {
  console.error('PROBE FAILED', error);
  process.exit(1);
});
