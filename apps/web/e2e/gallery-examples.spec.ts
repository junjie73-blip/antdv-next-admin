import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  expectActivePath,
  go,
  searchBox,
  signIn,
  tab,
  watchErrors,
} from './utils/app';

/**
 * 组件画廊新增的四页（总览 / 反馈 / 数据展示 / 指令）。
 *
 * `site-sweep.spec.ts` 已经会替我们跑一遍"打开不炸"，这里补的是**交互契约**：
 * 这四页都是给别人抄的模板，模板写错 API 的典型症状恰好是"页面照样渲染、点了没反应"
 * （Tabs 的 `@add` 就是这么个哑炮），只靠巡检看不出来。
 *
 * 另一条隐含断言：`<a-descriptions-item>` / `<a-collapse-panel>` / `<a-timeline-item>`
 * 这类**子组件写法**在 antdv-next 1.6 里到底还在不在。组件解析失败只出 warning，
 * 表现为"那块内容是空的"，所以这里直接断言里面的文字可见。
 */

const OVERVIEW = '/components/overview';
const FEEDBACK = '/components/feedback';
const DATA_DISPLAY = '/components/data-display';
const DIRECTIVE = '/components/directive';

/** 进页面并顺手把"控制台错误 / 接口 4xx"记进同一个桶 */
async function open(page: Page, path: string) {
  const errors = watchErrors(page);
  await go(page, path);
  return errors;
}

/**
 * 卡片墙上的链接。必须圈进内容区 `<main>`：外壳的多标签页也渲染成
 * `a[href^="#/components/"]`，不过滤的话"过滤到空"永远数到 1 个以上。
 */
function overviewLinks(page: Page) {
  return page.locator('main').locator('a[href^="#/components/"]');
}

function overviewLink(page: Page, path: string) {
  return page.locator('main').locator(`a[href="#${path}"]`);
}

/** 按卡片标题取那一块 `a-card` */
function card(page: Page, title: string) {
  return page.locator('.ant-card').filter({ has: page.getByText(title, { exact: true }) });
}

/**
 * 两字按钮的可访问名会被 antd 写成「成 功」（两个汉字之间插一个空格），
 * 所以这类名字一律用 `\s*` 容忍，不写死。三字以上不插。
 */
function cjkButton(scope: Page | ReturnType<typeof card>, label: string) {
  const pattern = new RegExp(`^${[...label].join('\\s*')}$`);
  return scope.getByRole('button', { exact: true, name: pattern });
}

test.describe('组件示例总览页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('卡片墙直接来自菜单，且能过滤后点进去', async ({ page }) => {
    const errors = await open(page, OVERVIEW);

    // 清单不自己抄一份：卡片数就是菜单叶子数，新页面进菜单就会出现在这里
    const cards = overviewLinks(page);
    const totalCount = await cards.count();
    expect(totalCount).toBeGreaterThan(20);
    // 模板换行让 textContent 以空格开头，所以这里不能上 `^` 锚
    await expect(page.getByText(/共 \d+ 个示例/)).toBeVisible();

    await searchBox(page, '按名称或路径过滤').fill('指令');
    await expect(overviewLink(page, DIRECTIVE)).toBeVisible();
    expect(await cards.count()).toBeLessThan(totalCount);
    await expect(page.getByText('已过滤')).toBeVisible();

    // 真链接 → 点了要落到目标页，并且外壳标签页跟着激活
    await overviewLink(page, DIRECTIVE).click();
    await expectActivePath(page, DIRECTIVE);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });

  test('过滤到没有匹配时给空状态，而不是留一片空白', async ({ page }) => {
    const errors = await open(page, OVERVIEW);

    await searchBox(page, '按名称或路径过滤').fill('不存在的示例名');
    await expect(page.getByText('没有匹配的示例页')).toBeVisible();
    expect(await overviewLinks(page).count()).toBe(0);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});

test.describe('反馈与交互页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('message / modal / popconfirm 真的会出现并消失', async ({ page }) => {
    const errors = await open(page, FEEDBACK);

    await cjkButton(card(page, 'Message 全局提示'), '成功').click();
    // `.ant-message-notice-wrapper` 与里面的 `.ant-message-notice` 都带类型类，
    // 只锁内层这一层，否则 toContainText 会因为命中两个节点而报 strict violation
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: 'success 类型的全球提示' }),
    ).toBeVisible();

    // 静态方法拿不到 ConfigProvider 上下文，这页必须走 useApp()：能渲染出带类型的节点即可
    await card(page, 'Modal 确认框')
      .getByRole('button', { name: '危险确认' })
      .click();
    const confirm = page.locator('.ant-modal-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('危险操作二次确认');
    await confirm.getByRole('button', { name: '确定删除' }).click();
    await expect(confirm).toBeHidden();

    await card(page, 'Modal 确认框')
      .getByRole('button', { name: '气泡确认' })
      .click();
    const pop = page.locator('.ant-popconfirm');
    await expect(pop).toBeVisible();
    await cjkButton(pop, '删除').click();
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: '气泡确认通过' }),
    ).toBeVisible();
    await expect(pop.first()).toBeHidden();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('通知落点跟随偏好设置，进度条真的在跑', async ({ page }) => {
    const errors = await open(page, FEEDBACK);

    await card(page, 'Notification 通知')
      .getByRole('button', { name: '成功通知' })
      .click();
    // 通知渲染在 body 末端的容器里，按标题文字找比抱类名稳（1.6 的类名结构换过）
    await expect(page.getByText('success 通知')).toBeVisible();

    const run = card(page, 'Progress 进度条').getByRole('button', { name: '跑一次进度' });
    await run.click();
    // 按钮在跑的时候锁住，避免连点叠定时器
    await expect(run).toBeDisabled();
    // 1.6 的线形进度是 rail / track / indicator 三段，百分比写在根节点的
    // `aria-valuenow` 上；老 API 的 `.ant-progress-bg` 这个类已经没有了
    const bar = card(page, 'Progress 进度条').getByRole('progressbar').first();
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')), {
        message: '定时器每 200ms 加一档，值要真的在涨',
      })
      .toBeGreaterThan(20);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});

test.describe('数据展示页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('子组件写法的三块内容真的渲染出来了', async ({ page }) => {
    const errors = await open(page, DATA_DISPLAY);

    await expect(card(page, 'Descriptions 描述列表').getByText('SO-20261010-0042')).toBeVisible();
    // 同一份数据渲染了两遍（默认 + alternate 模式），必须圈到卡片里再取第一个
    await expect(
      card(page, 'Timeline 时间线')
        .locator('.ant-timeline-item-content')
        .filter({ hasText: '2026-10-08 09:12 创建订单' })
        .first(),
    ).toBeVisible();
    await expect(page.getByText('为什么菜单是唯一数据源')).toBeVisible();
    // 折叠面板默认只展开第一项，第二项要点开才看到正文
    await page.getByText('为什么示例页不写内边距').click();
    await expect(page.getByText(/内边距归布局的滚动容器统一提供/)).toBeVisible();

    // 解析失败的组件只会静默变成空节点，用数量把三道关都钉住
    expect(await page.locator('.ant-descriptions-item-label').count()).toBeGreaterThanOrEqual(6);
    expect(await page.locator('.ant-timeline-item').count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator('.ant-collapse-item').count()).toBe(3);

    expect(errors.errors).toEqual([]);
    expect(
      errors.warnings.filter((text) => text.includes('Failed to resolve component')),
    ).toEqual([]);
    errors.stop();
  });

  test('editable-card 的增与删（1.6 只有 edit，没有 add 事件）', async ({ page }) => {
    const errors = await open(page, DATA_DISPLAY);
    const tabs = card(page, 'Tabs 标签页').locator('.ant-tabs').first();

    const before = await tabs.locator('.ant-tabs-tab').count();
    // editable-card 会把「+」渲染两份（常驻的一份 + 溢出收纳区的一份），取第一个
    await tabs.locator('.ant-tabs-nav-add').first().click();
    await expect(tabs.locator('.ant-tabs-tab').filter({ hasText: '新标签 4' })).toBeVisible();
    expect(await tabs.locator('.ant-tabs-tab').count()).toBe(before + 1);
    // 内容区：切换后旧面板只是 `ant-tabs-content-hidden`，还留在 DOM 里，
    // 所以只断言当前激活的那块
    const activePanel = tabs.locator('[role=tabpanel][aria-hidden=false]');
    await expect(activePanel).toContainText('新标签 4');

    await tabs.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first().click();
    await expect(tabs.locator('.ant-tabs-tab').filter({ hasText: '新标签 4' })).toHaveCount(0);
    expect(await tabs.locator('.ant-tabs-tab').count()).toBe(before);
    await expect(activePanel).not.toContainText('新标签 4');

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('步骤条 v-model:current 与图片预览', async ({ page }) => {
    const errors = await open(page, DATA_DISPLAY);

    // 1.6 的 Timeline 就是拿 Steps 的 DOM 实现的（每个 `.ant-timeline-item` 同时挂着
    // `ant-steps-item`），所以页级选择器会数到 12，必须圈在步骤条那张卡里
    const steps = card(page, 'Steps 步骤条');
    await expect(steps.locator('.ant-steps-item')).toHaveCount(4);
    await steps.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('当前第 3 步')).toBeVisible();
    await expect(steps.locator('.ant-steps-item-process')).toHaveCount(1);

    await card(page, 'Image 图片预览').locator('.ant-image img').first().click();
    await expect(page.locator('.ant-image-preview-img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-image-preview-img')).toBeHidden();

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });
});

test.describe('自定义指令页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('v-demo-permission 四种判定，勾选权限后已渲染的按钮自己翻正', async ({ page }) => {
    const errors = await open(page, DIRECTIVE);

    const box = card(page, 'v-permission 权限指令');
    const single = box.getByRole('button', { name: '单权限码' });
    const any = box.getByRole('button', { name: '任一命中' });
    const all = box.getByRole('button', { name: '全部命中' });
    const role = box.getByRole('button', { name: '按角色' });
    const admin = box.getByRole('button', { name: '仅超管' });
    const disabled = box.getByRole('button', { name: '无权限时置灰' });
    const object = box.getByRole('button', { name: '对象写法' });

    // 初始 grantedCodes=['user:add']、grantedRoles=['editor']
    await expect(single).toBeVisible();
    await expect(object).toBeVisible();
    await expect(any).toBeHidden();
    await expect(all).toBeHidden();
    await expect(role).toBeHidden();
    await expect(admin).toBeHidden();
    await expect(disabled).toBeVisible();
    await expect(disabled).toHaveClass(/permission-disabled/);
    await expect(disabled).toBeDisabled();

    await box.getByRole('checkbox', { name: 'user:export' }).check();
    await expect(any).toBeVisible();
    await expect(all).toBeHidden();
    await expect(disabled).not.toHaveClass(/permission-disabled/);
    await expect(disabled).toBeEnabled();

    await box.getByRole('checkbox', { name: 'user:delete' }).check();
    await expect(all).toBeVisible();

    await box.getByRole('checkbox', { name: 'auditor' }).check();
    await expect(role).toBeVisible();

    await box.getByRole('checkbox', { name: /super/ }).check();
    await expect(admin).toBeVisible();

    // 判定轨迹是订阅式重算的证据：改一次权限就多一条记录
    await expect(box.getByText('→ 放行').first()).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('v-loading 元素遮罩、深色文案与全屏遮罩', async ({ page }) => {
    const errors = await open(page, DIRECTIVE);
    const box = card(page, 'v-loading 元素级遮罩');

    await box.getByRole('button', { name: '加载这块' }).click();
    const spin = box.locator('.loading-directive-wrapper .loading-spin');
    await expect(spin).toBeVisible();
    await expect(spin).toHaveCount(1);
    // 2 秒后自己收起（撤遮罩有 out 过渡，留一点余量）
    await expect(box.locator('.loading-directive-wrapper')).toHaveCount(0, {
      timeout: 8000,
    });

    await box.getByRole('button', { name: '加载那块' }).click();
    await expect(box.locator('.loading-tip')).toContainText('正在拉取报表…');
    await expect(box.locator('.loading-large')).toBeVisible();
    await expect(box.locator('.loading-directive-wrapper')).toHaveCount(0, {
      timeout: 8000,
    });

    // `.fullscreen` 的容器挂在 body 上，但那层容器自身没有尺寸（可见性判定为 hidden），
    // 真正铺满视口的是里面的 `.loading-wrapper`，探针要往下走一层
    await box.getByRole('button', { name: '整页遮罩' }).click();
    const fullScreen = page.locator('body > .loading-directive-wrapper .loading-wrapper');
    await expect(fullScreen).toBeVisible();
    await expect(page.locator('body > .loading-directive-wrapper')).toHaveCount(0, {
      timeout: 8000,
    });

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('v-lazy 进视口才加载，坏地址回退到 error 图', async ({ page }) => {
    const errors = await open(page, DIRECTIVE);
    const box = card(page, 'v-lazy 图片懒加载');

    // 图片墙在页面中段，不先滚到它就一直不 intersect，计数永远是 0
    await box.scrollIntoViewIfNeeded();
    const gallery = box.locator('.grid img');
    await expect(gallery).toHaveCount(6);

    // 6 张里只有 5 张能换成目标图：最后一张刻意是坏地址，只会停在回退图上
    await expect(box.getByText('已换成目标图 5 / 6')).toBeVisible({
      timeout: 20_000,
    });

    const sources = await gallery.evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).getAttribute('src') ?? ''),
    );
    // 每张都已经有地址（占位图或目标图），不会留一张空 src
    expect(sources.every((src) => src.length > 0)).toBe(true);

    // 「重放」重挂图片墙：同 URL 命中全局缓存，一次到位而不是重新逐张涨
    await box.getByRole('button', { name: '重放（重新挂载图片墙）' }).click();
    await expect(box.getByText('已换成目标图 5 / 6')).toBeVisible({
      timeout: 20_000,
    });

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });

  test('v-safe-html 剥掉脚本与事件处理器，白名单能收窄', async ({ page }) => {
    const errors = await open(page, DIRECTIVE);
    const box = card(page, 'v-safe-html 与 v-escape 防 XSS');

    const rendered = box.locator('[data-safe-box="default"]');
    await expect(rendered).toContainText('这段是可以渲染的富文本');
    // 默认白名单保留结构与列表，说明"清理"不是"全删"
    expect(await rendered.locator('ul li').count()).toBe(2);
    // 四类载荷都进不去
    expect(await rendered.locator('script').count()).toBe(0);
    expect(await rendered.locator('svg').count()).toBe(0);
    expect(await rendered.locator('[onclick]').count()).toBe(0);
    expect(await rendered.locator('a[href^="javascript"]').count()).toBe(0);
    // 但文字内容本身还在，用户看得见被清掉了什么
    await expect(rendered).toContainText('带事件处理器的段落');

    const strict = box.locator('[data-safe-box="strict"]');
    await expect(strict).toContainText('这段是可以渲染的富文本');
    expect(await strict.locator('ul').count()).toBe(0);
    expect(await strict.locator('a').count()).toBe(0);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('v-escape 把脚本当纯文本，:url 把伪协议换成 #unsafe-url', async ({ page }) => {
    const errors = await open(page, DIRECTIVE);
    const box = card(page, 'v-safe-html 与 v-escape 防 XSS');

    // 指令的输出落在 `[data-escape-box]` 上；直接按文本选会把说明里的
    // `<code>#unsafe-url</code>` 一起选中
    const escaped = box.locator('[data-escape-box="text"]');
    await expect(escaped).toContainText('<script>');
    // 是文本，不是节点
    expect(await escaped.locator('script').count()).toBe(0);

    const urlNode = box.locator('[data-escape-box="url"]');
    await expect(urlNode).toHaveText('#unsafe-url');

    await box.getByRole('button', { name: '换成安全链接' }).click();
    // binding 变了 → `updated` 钩子重跑，同一个宿主节点换成转义后的安全链接，
    // 这既是响应性的证据，也顺手证明伪协议那条路是通的
    await expect(urlNode).toHaveText('https://example.com/report');

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('四页之间来回切换不留脏状态', async ({ page }) => {
    const errors = await open(page, DATA_DISPLAY);
    for (const path of [OVERVIEW, FEEDBACK, DIRECTIVE, DATA_DISPLAY]) {
      await go(page, path);
      await expectActivePath(page, path);
    }
    // 回来时页面被 keep-alive 缓存，之前加的第 4 个页签还在
    expect(await tab(page, DATA_DISPLAY).getAttribute('data-active')).toBe('true');
    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});
