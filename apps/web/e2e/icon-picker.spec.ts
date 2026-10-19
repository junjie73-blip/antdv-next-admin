import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * `IconPicker` 的浏览器契约。
 *
 * 这个组件刚从 antdv-next（`a-popover` + `a-input` + `a-select` + `a-pagination`）
 * 重写为 shadcn-ui（`Popover` + `Select` + `Input` + 自绘分页），外部契约一个字没改：
 * props、`v-model`、`@change` / `@select`、懒加载图标集、分页与搜索。
 * 用例因此刻意只断言"能力"而不是"实现"——角色、可读文案、`data-*` 钩子，
 * 这样下次再换底层库时这份用例仍然有意义。
 *
 * 三个只有浏览器能证伪的点：
 * 1. 图标集是按分类拆开的动态 chunk（`@iconify-json` 的 `icons.json`），
 *    只有真点一次分类切换才会发出那次请求；
 * 2. 面板渲染在 `PopoverPortal`（body 下），不在卡片 DOM 里，
 *    作用域写错就会"看不见面板"，是重写最容易踩的坑；
 * 3. 网格固定高度 + shadcn ScrollArea 自绘滚动条，滚动条属于组件不带系统滚动条。
 */

const ICON_PICKER = '/components/icon-picker';
/** 与 `IconPicker.vue` 的 `PAGE_SIZE` 一致：一页 108 个格子 */
const PAGE_SIZE = 108;

/**
 * 轻提示那只 toaster。
 *
 * 根部挂了**两只** `<Toaster />`（轻提示 + 通知，见 `apps/web/src/App.vue`），
 * 裸 `[data-sonner-toaster]` 会命中两个元素触发 strict mode；
 * 轻提示那只的位置由 `App.vue` 写死成"顶部居中"，按这两个属性收窄。
 */
function messageToaster(page: Page): Locator {
  return page.locator(
    'ol[data-sonner-toaster][data-x-position="center"][data-y-position="top"]',
  );
}

/** 按卡片标题取示例块（页面用 `@antdv/common-ui` 的 Card 分节，标题唯一） */
function card(page: Page, title: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/** 选择面板：`PopoverContent` 通过 portal 挂在 body 下 */
function panel(page: Page): Locator {
  return page.locator('[data-slot="popover-content"]');
}

/** 面板里的图标格子 */
function cells(box: Locator): Locator {
  return box.locator('div.grid > button');
}

/** 触发器：卡片内唯一的 combobox（面板里的分类下拉在 portal 里，不会串味） */
function trigger(page: Page, scope: Locator): Locator {
  return scope.locator('button[role="combobox"]');
}

test.describe('IconPicker（shadcn-ui 重写）', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('面板：打开后渲染网格，分页可翻，搜索能过滤到空态', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ICON_PICKER);

    const basic = card(page, '基础用法');
    await trigger(page, basic).click();

    const box = panel(page);
    await expect(box).toBeVisible();
    await expect(cells(box)).toHaveCount(PAGE_SIZE);

    // 默认分类 Lucide 超过一页 → 分页条出现，且第 1 页的"上一页"该禁掉
    const pager = box.locator('span').filter({ hasText: /^\d+ \/ \d+$/ });
    await expect(pager).toHaveText(new RegExp(`^1 / \\d+$`));
    await expect(box.getByRole('button', { name: '上一页' })).toBeDisabled();

    await box.getByRole('button', { name: '下一页' }).click();
    await expect(pager).toHaveText(/^2 \/ \d+$/);
    await expect(cells(box)).toHaveCount(PAGE_SIZE);
    await box.getByRole('button', { name: '上一页' }).click();
    await expect(pager).toHaveText(/^1 \/ \d+$/);

    // 搜索命中 0 条时走空态而不是空网格，且文案区分"没匹配"和"没图标"
    const search = box.locator('[data-slot="input"]');
    await expect(search).toHaveAttribute('placeholder', /在 Lucide 中搜索/);
    await search.fill('不存在的图标名');
    await expect(box.locator('[data-slot="empty"]')).toContainText(
      '没有匹配的图标',
    );
    await expect(cells(box)).toHaveCount(0);
    // 搜索会回到第 1 页（清空后恢复满页）
    await search.fill('');
    await expect(cells(box)).toHaveCount(PAGE_SIZE);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('换分类：动态 chunk 生效，搜索框占位符跟着换', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ICON_PICKER);

    const basic = card(page, '基础用法');
    await trigger(page, basic).click();
    const box = panel(page);
    await expect(cells(box)).toHaveCount(PAGE_SIZE);

    await box.locator('[data-slot="select-trigger"]').click();
    await page
      .locator('[data-slot="select-item"]')
      .filter({ hasText: 'Material Design' })
      .click();

    // 图标集按需加载：切换后仍是满页，且搜索提示换成了新分类名
    await expect(box.locator('[data-slot="input"]')).toHaveAttribute(
      'placeholder',
      /在 Material Design 中搜索/,
    );
    await expect(cells(box)).toHaveCount(PAGE_SIZE);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('选中与清除：v-model、@change 与面板收起', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ICON_PICKER);

    const basic = card(page, '基础用法');
    const triggerButton = trigger(page, basic);
    await expect(basic.getByText('已选：(无)')).toBeVisible();

    await triggerButton.click();
    const box = panel(page);
    // 格子没有可访问名称（图标无文字），用 Tooltip 的浮层反查标题会引入额外时序，
    // 这里断言"选完的值是 lucide 分类下的某个图标"就够——分类名是组件拼出来的
    await cells(box).first().click();

    await expect(box).toBeHidden();
    /**
     * 不用 `^…$` 锚定：示例页的插值写法是 `已选：{{ selectedIcon }}`，
     * 模板换行让 span 的文本以一个空格开头，Playwright 的 `getByText` 对正则
     * 不做 trim，锚定就变成"元素找不到"的假红。锚定交给 `toHaveText`（它会归一化）。
     */
    await expect(basic.getByText(/已选：lucide:\S+/)).toBeVisible();
    await expect(triggerButton.locator('[data-picker-value]')).toHaveText(
      /^lucide:\S+$/,
    );
    // 页面用 message 播报 @change，这条断言证明事件真的发出去了
    await expect(messageToaster(page)).toContainText(/已选择图标：lucide:/);

    // 清除：触发器尾部那颗 × 只发 change('')，不该把面板再打开
    await triggerButton.locator('[class*="hover:text-foreground"]').click();
    await expect(basic.getByText('已选：(无)')).toBeVisible();
    await expect(triggerButton.locator('[data-picker-value]')).toHaveCount(0);
    await expect(messageToaster(page)).toContainText(/已选择图标：\(/);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('默认值与禁用态', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ICON_PICKER);

    // 默认值：初始就带图标，面板不用打开就能看到当前值
    const preset = card(page, '默认值');
    await expect(preset.locator('[data-picker-value]')).toHaveText(
      'carbon:star-filled',
    );

    // 禁用：按钮原生 disabled，不参与点击
    const disabled = card(page, '禁用状态（只读）');
    await expect(trigger(page, disabled)).toBeDisabled();
    await expect(trigger(page, disabled)).toHaveCount(1);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('面板用 shadcn ScrollArea，不留系统滚动条', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ICON_PICKER);

    const basic = card(page, '基础用法');
    await trigger(page, basic).click();
    const box = panel(page);
    await expect(cells(box)).toHaveCount(PAGE_SIZE);

    /**
     * 面板高度是组件里写死的 `SCROLLER_HEIGHT`，滚动直接走 shadcn 的 ScrollArea
     * （icons 包不引 common-ui）：
     * 滚动元素带 `data-reka-scroll-area-viewport` 就是"原生条已被摘掉"的证据
     * （reka 给 viewport 注入了隐藏原生条的样式），也就是没有第二个"看得见但点不到"的系统滚动条。
     */
    const wrap = box.locator('[data-slot="scroll-area-viewport"]');
    await expect(wrap).toHaveAttribute('data-reka-scroll-area-viewport', '');
    await expect(wrap).toHaveCSS('overflow-y', 'scroll');

    /**
     * 一页 108 格（12 列 × 9 行）正好铺满固定高度，所以此刻不该出现轨道 ——
     * ScrollArea 的轨道要"悬停 + 真的溢出"才挂进 DOM。
     * "溢出时轨道要出现、能拖能滚"由 `shell-scroll.spec.ts` 覆盖，这里不重复造场景。
     */
    await expect(
      box.locator('[data-slot="scroll-area-scrollbar"]'),
    ).toHaveCount(0);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});
