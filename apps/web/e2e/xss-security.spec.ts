import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * XSS 安全基线。
 *
 * 上游模板里这份用例是坏的：它把地址写死成 `localhost:9080`，
 * 还要访问 `/components/table/basic`、`/components/editor/markdown`——
 * 这两个路径不在后端菜单里，守卫（`canAccess(name) || canAccessPath(path)`）
 * 会把它们判成 403，用例只是在验证 403 页面能打开。
 *
 * 现在改成检查**真实可达页面**的运行时产物：
 * 渲染出来的内容里不该出现 `javascript:` 链接、内联事件处理器或注入的 `<script>`。
 * 指令本身的行为由 `@antdv/directives` 的单测覆盖（`v-safe-html` 会先过 DOMPurify），
 * 这里只补"接进真实页面之后没有跑偏"这一层。
 */

/** 遍历的可达页面都在菜单里，不会撞 403 */
const PAGES = ['/dashboard/analysis', '/system/user', '/system/notice'];

test.describe('XSS 安全基线', () => {
  test('登录页标题与外壳可用', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#/login');
    await expect(page).toHaveTitle(/Antdv/);
    expect(errors.errors).toEqual([]);
  });

  for (const path of PAGES) {
    test(`渲染产物不含可执行注入：${path}`, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page);
      await go(page, path);

      const audit = await page.evaluate(() => {
        const text = (selector: string) =>
          [...document.querySelectorAll(selector)].map((el) =>
            (el.getAttribute('href') ?? el.getAttribute('src') ?? '').trim(),
          );
        return {
          inlineHandlers: document.querySelectorAll(
            '[onclick],[onload],[onerror],[onmouseover]',
          ).length,
          injectedScripts: document.querySelectorAll('script:not([src])')
            .length,
          javascriptLinks: text('a[href^="javascript:"]').length,
          // 内容区里出现 <script> 标签通常意味着某处把未净化的 HTML 直接塞进了 DOM
          scriptTagsInContent: document.querySelectorAll(
            '[class*="content"] script',
          ).length,
        };
      });

      expect(audit.javascriptLinks).toBe(0);
      expect(audit.inlineHandlers).toBe(0);
      expect(audit.scriptTagsInContent).toBe(0);
      expect(audit.injectedScripts).toBe(0);
      expect(errors.errors).toEqual([]);
    });
  }
});
