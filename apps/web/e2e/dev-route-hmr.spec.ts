import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { go, region, signIn } from './utils/app';

/**
 * 开发态"改页面文件会不会把布局改没"。
 *
 * 这一条只有 dev 能验，也只有 dev 会坏：`vue-router/auto-routes` 自带的 HMR 逻辑是
 * `router.clearRoutes()` 之后逐条 `addRoute(新生成的裸路由)`；而本项目用的
 * `vite-plugin-vue-layouts-next` 是把布局**编译进路由表**的 —— `setupLayouts()` 给每个
 * 页面套一层 `{ component: LayoutWrapper, meta.isLayout }` 的父记录，
 * 这层父记录**没有 name**，裸路由里根本不存在它。
 * 于是改一下二级页面（`views/system/user/index.vue` 这种），页面就被挂回顶层，
 * 顶栏 / 侧栏 / 标签栏 / 面包屑整套外壳一起消失，只能整页刷新找回来。
 * 更阴的是它按 name 自愈不回来：`stores/modules/route.ts` 的注册表对齐靠
 * `router.hasRoute(name)` 判断"这条还在不在"，布局壳没有 name，永远判不到它缺席。
 *
 * 生产构建里 `import.meta.hot` 被替换成 false，这段逻辑整个不进包，
 * 所以这条用例保护的是"开发者每天要过的那十几个小时"，不是线上。
 *
 * 只在 chromium 跑：一次页面文件改动会让 dev server 给**所有**连着的浏览器重发
 * 路由表更新，三个引擎同时既改又看就成了互相制造噪音；而被保护的东西（路由表重建）
 * 与引擎无关。
 */
const PAGE_FILE = resolve(process.cwd(), 'src/views/system/user/index.vue');

test.describe('开发态路由热更新', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    '改源文件会影响所有引擎，只在 chromium 保留一份',
  );

  test('改二级页面文件后，一级布局与静态路由都还在', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));

    await signIn(page);
    await go(page, '/system/user');
    await expect(region(page, 'sidebar')).toBeVisible();
    await expect(page.locator('.ant-table').first()).toBeVisible();

    const original = await readFile(PAGE_FILE, 'utf8');
    try {
      await writeFile(PAGE_FILE, `${original}\n<!-- e2e：触发一次约定路由热更新 -->\n`, 'utf8');

      /**
       * 先证明"约定路由模块真的被热更新过"。
       * 这一步不是仪式：如果 dev server 没触发那次 `clearRoutes() + addRoute(裸路由)`，
       * 后面的每条断言都只是在检查启动时的状态，坏掉也照样绿 —— 空跑的用例比没有用例更坏。
       */
      await expect
        .poll(() => logs.some((text) => text.includes('vue-router/auto-routes')), {
          message: '没观察到约定路由模块的热更新，下面的断言会是空跑',
          timeout: 20_000,
        })
        .toBe(true);

      // 外壳还在，而且没有重复套第二层（多套一层会数出 2 个侧栏）
      await expect(region(page, 'sidebar')).toHaveCount(1);
      await expect(region(page, 'header')).toHaveCount(1);
      // 二级页面仍然渲染在布局里，而不是脱离外壳变成整屏
      await expect(page.locator('.ant-table').first()).toBeVisible();

      /**
       * 静态路由也没被那次 `clearRoutes()` 带走。
       *
       * 必须用改 hash 而不是 `page.goto()`：goto 若触发整页加载，前端会重新启动一遍，
       * 路由表按启动逻辑重建，"热更新后静态路由还在吗"这条就永远为真 —— 又是空跑。
       *
       * `/login` 还在注册表里的证据也不是"登录页渲染出来"（已登录会被守卫请回首页），
       * 而是"它被匹配到了"：这条常量路由缺席时，hash 会落到通配兜底去 /error/404。
       */
      await page.evaluate(() => {
        window.location.hash = '#/login';
      });
      await expect(page, '/login 没匹配到，被兜底路由接管了').toHaveURL(/#\/dashboard/);

      // 兜底 404 也还在：没有它，乱敲地址的表现是白屏而不是错误页
      await page.evaluate(() => {
        window.location.hash = '#/no-such-page-in-this-app';
      });
      await expect(page, '404 兜底路由被热更新清掉了').toHaveURL(/#\/error\/404/);
    } finally {
      // 还原必须发生在任何断言失败之后仍然执行：留着那行注释，后面每一轮跑的都是被改过的树
      await writeFile(PAGE_FILE, original, 'utf8');
    }
  });
});
