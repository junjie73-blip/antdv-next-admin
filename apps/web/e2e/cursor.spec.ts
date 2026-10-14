import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  go,
  openPreferenceDrawer,
  signIn,
} from './utils/app';

/**
 * 光标即"这里能不能点"的唯一即时答案。
 *
 * 用户的原话是"能 hover 的盒子都需要带上 cursor"：本项目大量可点的盒子是手写的
 * `<button type="button">`（设置面板的主题色块、圆角/布局磁贴、通知面板的按钮、
 * Markdown 工具栏、分片上传的操作键），而浏览器**不会**自动给 `<button>` 指针光标
 * —— UA 样式里它是 `default`。以前靠逐个模板补 `cursor-pointer`，漏一处就出现
 * "盒子亮了、鼠标还是箭头"，用户以为页面卡死。
 *
 * 现在规则住在 `packages/core/base/design/src/base.css`，所以这里验的是**浏览器算出来的光标**，
 * 而不是模板里有没有写那个类 —— 类名断言只能证明"有人写了字"，证明不了它生效、
 * 也证明不了没被 antd 的规则盖掉。
 */

/** 计算样式上的光标值 */
function cursorOf(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).cursor);
}

/**
 * 指针光标应该出现的可点件。
 * 每条都是"点了真有事发生"的元素，antd 自己没给或只给了一部分的排在后面。
 */
const POINTER_TARGETS: Array<[string, string]> = [
  ['/system/user', 'button'],
  ['/system/user', '.ant-btn-link'],
  ['/system/user', '[data-slot="pagination-item"]'],
  ['/system/user', '[role="menuitem"]'],
  ['/components/upload', '.ant-upload-select'],
  // 树节点：原先挂在「组件示例 → 树形控件」那页，那页演示的是裸 antd，已随示例节收敛删掉，
  // 换成真实的树形业务页（部门管理的部门树）
  ['/system/dept', '.ant-tree-node-content-wrapper'],
  // 开关：拖拽排序示例页的「整表冻结」开关
  ['/components/table/drag-sort', '.ant-switch:not(.ant-switch-disabled)'],
  // 单选按钮组：分析面板的时间范围切换
  ['/dashboard/analysis', '.ant-radio-button-wrapper'],
  /*
   * 评分组件：外层 `<li>` 一直是 pointer，漏的是鼠标真正停在的那个 `role="radio"` 的 div。
   * 这条是"按 ARIA role 接光标"那条样式规则的现场证据。
   * 落在基础表单示例页——它把 `Rate` 当成 BasicForm 的 schema 字段在用。
   */
  ['/components/form/basic', '.ant-rate-star div[role="radio"]'],
];

/**
 * "看着能点、其实点了没反应"的盒子：只有装饰性的 hover 反馈，没有 click。
 * 给它们指针光标是在撒谎，所以扫描放行；但必须留名 —— 以后谁让这类盒子真的可点了，
 * 就要么从这里删掉、要么补上 click，不能靠"扫描本来就看不见它"糊过去。
 */
const DECORATIVE_HOVER_ALLOWLIST: string[] = [];

/**
 * 全站兜底扫描：可见的 `<button>` / `<a>` / `[role=button|tab|...]` /
 * 带 `hover:bg-*`、`hover:outline-*`、`hover:shadow` 的盒子，光标不能是箭头或文本态。
 */
const SWEEP = String.raw`
(allow) => {
  const OK = ['pointer', 'grab', 'grabbing', 'not-allowed', 'col-resize', 'row-resize', 'move', 'zoom-in', 'help'];
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || !el.checkVisibility()) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/\bpointer-events-none\b/.test(cls)) continue;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue;
    // antd 的 loading 按钮故意不给指针：点了也没用，这不是缺陷
    if (cls.includes('ant-btn-loading')) continue;
    const role = el.getAttribute('role') || '';
    const looksClickable =
      el.tagName === 'BUTTON' ||
      el.tagName === 'A' ||
      role === 'button' ||
      /^(tab|menuitem|switch|checkbox|radio|combobox|option|link)$/.test(role) ||
      /(^|\s)hover:(bg|border|text|shadow|outline|scale|underline)/.test(cls) ||
      /(^|\s)group-hover:(bg|border|text|shadow|outline)/.test(cls);
    if (!looksClickable) continue;
    const cursor = getComputedStyle(el).cursor;
    if (OK.includes(cursor)) continue;
    // 设置面板的开关行（SettingItem 留了 data-setting-label 钩子）：
    // hover 描出外框是"帮你找到那个开关"，可点的是行尾的控件本身，不是整行
    if (el.hasAttribute('data-setting-label')) continue;
    const key = el.tagName.toLowerCase() + '|' + cls.trim().split(/\s+/).slice(0, 4).join(' ');
    if (allow.includes(key)) continue;
    out.push({
      key,
      cursor,
      role,
      text: (el.textContent || '').trim().slice(0, 20),
      html: el.outerHTML.slice(0, 100),
    });
  }
  const seen = new Set();
  return out.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)));
}
`;

async function sweep(page: Page) {
  return page.evaluate(
    `(${SWEEP})(${JSON.stringify(DECORATIVE_HOVER_ALLOWLIST)})`,
  );
}

/**
 * 导航等待上限。
 *
 * 这两条用例都要连着走 4-5 个路由，而 dev server 是**按需编译**的：某个引擎第一次
 * 进 `/components/editor` 得现编 MarkdownEditor 那一整棵依赖树。
 * 三引擎整跑时（前面的引擎已经把 Vite 的编译缓存挤掉过一轮）WebKit 会顶到 `go()`
 * 默认的 20s 上，表现是"标签页没亮起来"这种纯计时失败 —— 单跑立刻绿。
 * 只放宽这一处的等待，不动全局 expect 超时：光标真坏了仍然立刻红。
 */
const NAV_TIMEOUT = 40_000;

test.describe('可交互元素的光标', () => {
  test('该是指针的地方，浏览器算出来就得是指针', async ({ page }) => {
    await signIn(page);
    const visited = new Set<string>();
    for (const [path, selector] of POINTER_TARGETS) {
      if (!visited.has(path)) {
        await go(page, path, NAV_TIMEOUT);
        visited.add(path);
      }
      const target = page.locator(selector).first();
      // 先确认这个可点件真的在页面上：选择器写错了要红，不能空过
      await expect(target, `${path} 上找不到 ${selector}`).toBeVisible();
      await expect
        .poll(() => cursorOf(target), {
          message: `${path} 上 ${selector} 没有可点光标`,
        })
        .toBe('pointer');
    }
  });

  test('禁用的按钮不能装成能点', async ({ page }) => {
    await signIn(page);
    await go(page, '/components/upload');

    // 分片上传的"开始上传"在没有文件时是 disabled 属性（不是 pointer-events 假禁用）
    const disabled = page.locator('button:disabled').first();
    await expect(disabled).toBeVisible();
    expect(await cursorOf(disabled)).toBe('not-allowed');

    // 反证：同页面的可用按钮必须是指针，否则上一条只是因为整页都写了 not-allowed 而"通过"
    expect(await cursorOf(page.locator('button:not(:disabled)').first())).toBe(
      'pointer',
    );
  });

  test('设置抽屉里的色块、磁贴与所有按钮都是指针', async ({ page }) => {
    await signIn(page);
    // 抽屉浮在任何页面之上，这里不必先导航 —— 少一次导航，webkit 上就少一次超时机会

    for (const section of ['外观', '布局'] as const) {
      const drawer = await openPreferenceDrawer(page, section);
      // 抽屉里所有可点的 button：主题色块、圆角倍率、布局磁贴、标签风格、关闭键
      const buttons = await drawer.locator('button:not(:disabled)').all();
      expect(
        buttons.length,
        `${section} 面板里一个可点按钮都没有？`,
      ).toBeGreaterThan(0);
      for (const [index, button] of buttons.entries()) {
        expect(
          await cursorOf(button),
          `${section} 面板第 ${index + 1} 个按钮没有指针光标`,
        ).toBe('pointer');
      }
      // 分段选择器（标签风格、布局模式）也是"能 hover 的盒子"
      const segmented = drawer.locator('.ant-segmented-item').first();
      if (await segmented.count()) {
        expect(
          await cursorOf(segmented),
          `${section} 面板的分段选项没有指针光标`,
        ).toBe('pointer');
      }
      await closePreferenceDrawer(page);
    }
  });

  test('兜底扫描：全站不该有"看着能点其实是箭头"的盒子', async ({ page }) => {
    await signIn(page);
    for (const path of [
      '/system/user',
      '/components/overview',
      '/components/upload',
      '/components/loading',
      '/components/editor',
    ]) {
      await go(page, path, NAV_TIMEOUT);
      const offenders = await sweep(page);
      expect(offenders, `${path} 有缺光标的可点盒子`).toEqual([]);
    }

    for (const section of ['外观', '布局', '通用'] as const) {
      await openPreferenceDrawer(page, section);
      const offenders = await sweep(page);
      expect(offenders, `设置抽屉 ${section} 有缺光标的可点盒子`).toEqual([]);
      await closePreferenceDrawer(page);
    }
  });
});
