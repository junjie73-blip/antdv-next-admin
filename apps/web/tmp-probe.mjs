import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 400)));

await page.goto('http://localhost:6080/#/login');
await page.getByPlaceholder('请输入用户名').fill('admin');
await page.getByPlaceholder('请输入密码').fill('admin123');
await page.getByRole('button', { exact: true, name: '登录' }).click();
await page.waitForTimeout(3000);
await page.evaluate(() => {
  window.location.hash = '#/enterprise/ai-flow';
});
await page.waitForTimeout(4000);
await page.getByLabel(/工单原话/).fill('物流一直不动，帮我看看这单到哪了');
await page.locator('[data-slot="ai-run-panel"] [data-action="run"]').click();
await page.waitForTimeout(3000);
const edges = await page.$$eval('.vue-flow__edge', (els) =>
  els.map((el) => ({
    // 前两个属性就够定位了：data-id + class
    attrs: [...el.attributes]
      .map((a) => `${a.name}=${a.value}`)
      .filter((s) => s.startsWith('data-') || s.startsWith('class='))
      .join(' | '),
    stroke: getComputedStyle(el.querySelector('path') ?? el).stroke,
  })),
);
console.log(JSON.stringify(edges, null, 2));
await browser.close();
