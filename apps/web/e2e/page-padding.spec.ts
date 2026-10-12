import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn } from './utils/app';

/**
 * 内边距只有一层：布局的 `<Scrollbar view-class="p-4">` 负责，路由页面自己不加。
 *
 * 页面里再写一份 `p-4`/`p-5`/`p-6`，表现是内容离边缘 40px、跟别的页面对不齐。
 * 单测（`src/views/__tests__/page-root-padding.spec.ts`）从源码角度扫根容器，
 * 这里从渲染结果角度量真实计算样式 —— 源码扫描看不到 `cn()` 拼接的最终值，
 * 计算样式看不到"没渲染出来的分支"，两边各补对方的盲区。
 *
 * 量的是"内容区第一个子元素"，也就是路由页面渲染出来的最外层节点；
 * 它的直接父节点就是那个 view。
 */
async function paddingOf(page: Page) {
  return page.evaluate(() => {
    const view = document.querySelector(
      '.ant-layout-content .scrollbar__view',
    ) as HTMLElement | null;
    const pageRoot = view?.firstElementChild as HTMLElement | null;
    const read = (el: HTMLElement | null) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        bottom: style.paddingBottom,
        left: style.paddingLeft,
        // 把身份也带回来：量错节点（比如套了一层过渡容器）时报告要能自证
        node: `${el.tagName.toLowerCase()}.${(el.className || '').split(/\s+/)[0] ?? ''}`,
        top: style.paddingTop,
      };
    };
    return { pageRoot: read(pageRoot), view: read(view) };
  });
}

const PAGES = [
  // 原来根容器写 p-4 的编辑器页（现在是 Markdown/富文本合并后的那一页；
  // h-full 布局，padding 一变高度链就跟着变，最容易看出问题）
  '/components/editor',
  // 原来写 p-5 的计算属性页（源码扫描扫不到字面量，靠这条兜住）
  '/security/dashboard',
  // 原来写 p-6 的测试页已经删掉了（`/demo/table-pagination-test` 是排障时临时建的，
  // 不是一个组件），换成同样"根容器套着带分页的表格"的示例页，量的是同一条高度链
  '/components/table/basic',
  // 本来就是"干净页"的基线，确认改动没把别人带坏
  '/system/user',
];

test.describe('路由页面不重复加内边距', () => {
  for (const path of PAGES) {
    test(`${path} 的内容只有布局那一层 16px`, async ({ page }) => {
      test.setTimeout(180_000);
      await signIn(page);
      await go(page, path);

      await expect
        .poll(async () => (await paddingOf(page)).view?.top ?? '', {
          timeout: 30_000,
        })
        .toBe('16px');

      const { pageRoot, view } = await paddingOf(page);
      expect(view, '布局的 16px 必须还在（挪走了这条要一起改）').toMatchObject({
        bottom: '16px',
        left: '16px',
        top: '16px',
      });
      expect(pageRoot, `${path} 的页面根容器不该再有内边距`).toMatchObject({
        bottom: '0px',
        left: '0px',
        top: '0px',
      });
    });
  }
});
