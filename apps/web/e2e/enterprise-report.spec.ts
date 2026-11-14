import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, painted, signIn, watchErrors } from './utils/app';

/**
 * 报表设计器的浏览器验证。
 *
 * 包内单测把 `core/*` 的口径证明得很足（聚合、透视、格式化、脏行处置都是纯函数），
 * 但有三类结论只有真浏览器能给出，这一页就是照着它们写的：
 *
 * 1. **两张图真的画到 canvas 上了** —— 包内组件测试跑在 jsdom，那里没有 canvas，
 *    所以 `widgetChart` 是被一个假组件注入的；构建一旦把 echarts 拆歪（或 `height` 塌成 0），
 *    单测照样全绿。这里直接读像素。
 * 2. **frappe-gantt 的 CSS 与 SVG 一起到位** —— 库样式走的是
 *    `@import '../../../node_modules/frappe-gantt/dist/frappe-gantt.css'` 这条相对路径
 *    （`exports` 没导出 CSS 子路径，裸包名又被 postcss 当 JS 解析，两种"正规"写法都实测不成立），
 *    路径一漏，甘特会画成"没有样式的一坨 rect"；而本包的 token 覆写写在 `@layer components` 里，
 *    漏了就是暗色主题上浮着一块库自带的浅蓝条。所以断言 `.bar-progress` 的填充色**等于主题主色**。
 * 3. **栅格几何是 CSS Grid 算出来的** —— `x/y/w/h` 是运行时数字，内联样式在 mount 测试里读得出
 *    却量不准，只有浏览器能证明「并排的两格不重叠、宽格的確比窄格宽」。
 *
 * 数据侧全程走内存表（`presets/sales-report` 的 180 行固定种子），所以 `badResponses` 为空
 * 本身就是结论：这一页一次业务请求都不该发。
 */

const CARD = '[data-slot="card"]';
const VIEWER = '[data-slot="report-viewer"]';
const WIDGET = '[data-slot="report-widget"]';
const GANTT = '[data-slot="report-gantt"]';
const DESIGNER = '[data-slot="report-designer"]';

type Box = { height: number; width: number; x: number; y: number };

function viewer(page: Page): Locator {
  return page.locator(VIEWER);
}

function widget(page: Page, id: string): Locator {
  return viewer(page).locator(`[data-widget-id="${id}"]`);
}

function card(page: Page, title: string): Locator {
  return page.locator(CARD).filter({ hasText: title });
}

async function openReportPage(page: Page) {
  await signIn(page);
  await go(page, '/enterprise/report');
  await expect(viewer(page)).toBeVisible();
}

/** 六格的屏幕矩形，DOM 顺序即 `ReportViewer` 排过的顺序（先 y 后 x） */
async function widgetBoxes(scope: Locator): Promise<Box[]> {
  // `Promise.all` 不能省：`await [p1, p2]` await 的是那个**数组**（不是 thenable），
  // 拿回来的是未决议的 Promise，读 `.x` 全是 undefined，几何断言会静默变成永真/永假
  const boxes = await Promise.all(
    (await scope.all()).map(async (el) => await el.boundingBox()),
  );
  return boxes.filter((box): box is Box => !!box);
}

function overlapping(boxes: Box[]): boolean {
  return boxes.some((a, i) =>
    boxes
      .slice(i + 1)
      .some(
        (b) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height,
      ),
  );
}

/** KPI 卡上的金额文本摊成数字；空态的 `—` 摊成 0，正好用来判"没数就是没数" */
async function kpiAmount(page: Page, id: string): Promise<number> {
  const text = await widget(page, id).innerText();
  return Number(text.replaceAll(/[^\d.]/gu, '')) || 0;
}

/**
 * 数一片非透明像素。
 *
 * 为什么不用 `toBeVisible()`：canvas 元素本身可见与"上面真的画了东西"是两件事，
 * echarts 容器高度塌成 0、option 里 series 为空、渲染器没起来，三种情况都照样"可见"。
 * 每 97 个像素取一个 alpha，够把空图和有图分开，又不至于在 CI 上拷回整张位图。
 */
async function inkedPixels(
  scope: Locator,
): Promise<{ height: number; inked: number; width: number }> {
  return scope.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return { height: 0, inked: 0, width: 0 };
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let inked = 0;
    for (let i = 3; i < data.length; i += 4 * 97) {
      if ((data[i] ?? 0) > 0) inked += 1;
    }
    return { height: canvas.height, inked, width: canvas.width };
  });
}

test.describe('报表设计器', () => {
  test('六格各就各位：KPI 出金额、两张图真画到 canvas、栅格铺开不重叠', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openReportPage(page);

    await expect(viewer(page)).toHaveAttribute('data-widget-count', '6');
    await expect(viewer(page).locator(WIDGET)).toHaveCount(6);

    // 币种 + 千分位 + 固定两位小数：这是 `core/format` 的口径，但只有浏览器会把它排成字符串
    await expect(widget(page, 'kpi-sales')).toHaveText(/¥[\d,]+\.\d{2}/u);

    // 图表：容器有尺寸且像素上有墨，等价于"echarts 起来了、option 有 series、CSS 高度生效"
    for (const id of ['chart-region', 'chart-trend']) {
      const canvas = widget(page, id).locator('canvas').first();
      await expect(canvas).toBeVisible();
      const info = await inkedPixels(canvas);
      expect(info.width, `${id} 的画布宽度为 0`).toBeGreaterThan(100);
      expect(info.height, `${id} 的画布高度为 0`).toBeGreaterThan(60);
      expect(info.inked, `${id} 画布上一个像素都没有`).toBeGreaterThan(10);
    }

    // 透视与明细各有自己的表体，说明这两条渲染分支都走到了
    await expect(
      widget(page, 'pivot-region-category').locator('[data-pivot-row]').first(),
    ).toBeVisible();
    await expect(
      widget(page, 'table-detail').locator('[data-row-index]').first(),
    ).toBeVisible();
    // 明细表带合计行：`options.showTotals` 从 DSL 一路走到 DOM
    await expect(
      widget(page, 'table-detail').locator(
        '[data-slot="report-widget-total-row"]',
      ),
    ).toContainText('合计');

    const boxes = await widgetBoxes(viewer(page).locator(WIDGET));
    expect(boxes).toHaveLength(6);
    expect(overlapping(boxes), '栅格里有格子叠在一起').toBe(false);
    // 同一行并排至少两格：证明 `gridColumn/gridRow` 那套内联样式真的被 Grid 解释了
    const firstRow = boxes.filter((box) => Math.abs(box.y - boxes[0]!.y) < 4);
    expect(firstRow.length, '第一行没有并排的格子').toBeGreaterThan(1);
    // 跨 6 列的图表格应当明显宽于跨 3 列的 KPI 格（比例 2:1，留出生成余量）
    const chartBox = await widget(page, 'chart-region').boundingBox();
    const kpiBox = await widget(page, 'kpi-sales').boundingBox();
    expect(chartBox!.width).toBeGreaterThan(kpiBox!.width * 1.5);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('过滤条改一处日期，报表当场重算：区间收窄金额变小，区间填反全部落空', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openReportPage(page);

    const bar = page.locator('[data-slot="report-filter-bar"]');
    await expect(bar).toHaveAttribute('data-filter-count', '4');

    const between = bar.locator('[data-filter-kind="between"] input');
    const all = await kpiAmount(page, 'kpi-sales');

    // 起始日推到 03-28：180 行只剩 3 天，KPI 必须跟着掉，且不需要任何请求
    await between.first().fill('2026-03-28');
    await expect
      .poll(async () => await kpiAmount(page, 'kpi-sales'), { timeout: 10_000 })
      .toBeLessThan(all / 2);

    // 区间填反（起 > 止）是真实输入里最常见的一种"没有数据"：
    // 每一格都要落到空态，KPI 给占位符而不是 0 —— 0 是一个业务事实，"没数"不是
    await between.nth(1).fill('2026-03-27');
    await expect(
      widget(page, 'table-detail').locator('[data-slot="report-widget-empty"]'),
    ).toBeVisible();
    await expect(
      widget(page, 'chart-region').locator('[data-slot="report-widget-empty"]'),
    ).toBeVisible();
    await expect(widget(page, 'kpi-sales')).toContainText('—');
    expect(await kpiAmount(page, 'kpi-sales')).toBe(0);

    await bar.locator('[data-slot="report-filter-clear"]').click();
    await expect
      .poll(async () => await kpiAmount(page, 'kpi-sales'))
      .toBeGreaterThan(all / 2);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('设计器加一格，视图当场多一格：两处吃的是同一份 DSL', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openReportPage(page);

    const designer = page.locator(DESIGNER);
    await expect(designer).toHaveAttribute('data-widget-count', '6');

    await designer.locator('[data-action="add-widget"]').click();

    // 设计器多一行、视图多一格，且新格真的取到了数（不是只多了个空壳）
    await expect(designer.locator('[data-designer-widget]')).toHaveCount(7);
    await expect(viewer(page)).toHaveAttribute('data-widget-count', '7');
    await expect(viewer(page).locator('[data-widget-type="kpi"]')).toHaveCount(
      3,
    );
    await expect(viewer(page).locator(WIDGET).last()).toHaveText(
      /¥[\d,]+\.\d{2}|—/u,
    );

    // 删掉最后那一格回到 6：`remove-widget` 走的是同一条 emit('update:spec') 路径
    await designer
      .locator('[data-designer-widget]')
      .last()
      .locator('[data-action="remove-widget"]')
      .click();
    await expect(viewer(page)).toHaveAttribute('data-widget-count', '6');

    // 重置示例报表：整份 spec 重新生成，设计器与视图一起回到出厂的 6 格
    await designer.locator('[data-action="add-widget"]').click();
    await card(page, '报表视图')
      .getByRole('button', { exact: true, name: '重置示例报表' })
      .click();
    await expect(viewer(page)).toHaveAttribute('data-widget-count', '6');

    expect(errors.errors).toEqual([]);
  });

  test('明细表头点一下真的换序，并把 sort 抛给宿主', async ({ page }) => {
    const sorted: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('[report] sort')) sorted.push(message.text());
    });
    await openReportPage(page);

    const table = widget(page, 'table-detail');
    const before = await table.locator('[data-row-index="0"]').innerText();

    await table.locator('[data-sort-field="sum_sales"]').click();

    // 本地换序 + 事件外抛两件事都要发生：只 emit 不排是"点了没反应"，只排不 emit 是"宿主永远重取不了"
    await expect
      .poll(async () => await table.locator('[data-row-index="0"]').innerText())
      .not.toBe(before);
    expect(sorted.length, '宿主没收到 sort 事件').toBeGreaterThan(0);
  });

  test('甘特：frappe 的 SVG 与样式都落地，脏行挡在外面并报数', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openReportPage(page);

    const gantt = page.locator(GANTT);
    // 7 行里 1 行「结束早于开始」，core 挡掉并当场说出挡了几行
    await expect(gantt).toHaveAttribute('data-task-count', '6');
    await expect(gantt).toHaveAttribute('data-skip-count', '1');
    await expect(
      gantt.locator('[data-slot="report-gantt-header"]'),
    ).toContainText('有 1 行');

    // 库自己建的 DOM：`.gantt-container` + `<svg class="gantt">` + 每任务一个 `.bar-wrapper`
    await expect(gantt.locator('svg.gantt')).toBeVisible();
    await expect(gantt.locator('.bar-wrapper')).toHaveCount(6);
    // 时间轴铺开：条的 x 不止一个值，说明 viewBox/坐标真的算过，而不是全叠在原点
    const xs = await gantt
      .locator('.bar')
      .evaluateAll((els) =>
        els.map((el) => Number((el as SVGRectElement).getAttribute('x'))),
      );
    expect(new Set(xs).size, '所有任务条都落在同一个 x').toBeGreaterThan(1);

    // 库 CSS + 本包 token 覆写同时生效：进度段吃的是主题主色，不是 frappe 写死的裸色
    const fill = await gantt
      .locator('.bar-progress')
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe(await painted(page, 'hsl(var(--primary))'));

    // 只读时库不挂拖拽把手；放开后重建实例，把手才出现（这一条是 props → 库 options 的唯一观测点）
    await expect(gantt.locator('.handle')).toHaveCount(0);
    await card(page, '甘特视图')
      .getByRole('button', { exact: true, name: '允许拖拽改期' })
      .click();
    await expect(gantt.locator('.handle').first()).toBeVisible();

    // 切档位走完整往返：工具条 emit('update:viewMode') → 页面 ref → prop → aria-pressed
    await gantt
      .locator('[data-action="gantt-view-mode"]')
      .filter({ hasText: '月' })
      .click();
    await expect(
      gantt
        .locator('[data-action="gantt-view-mode"]')
        .filter({ hasText: '月' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(gantt.locator('.bar-wrapper')).toHaveCount(6);
    await gantt.locator('[data-action="gantt-redraw"]').click();
    await expect(gantt.locator('.bar-wrapper')).toHaveCount(6);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('纯函数那一节：同一套 core 在页面里直接算出的两张表', async ({
    page,
  }) => {
    await openReportPage(page);

    const section = card(page, '纯函数口径');
    const grouped = section.locator('table').first();
    const pivoted = section.locator('table').nth(1);

    await expect(grouped.locator('tbody tr')).toHaveCount(4); // 3 个区域 + 1 行合计
    await expect(grouped).toContainText('合计');
    await expect(grouped).toHaveText(/¥[\d,]+\.\d{2}/u);
    // 百分比列由聚合引擎顺手算出，格式跟着字段走
    await expect(grouped).toHaveText(/\d+(\.\d)?%/u);

    await expect(pivoted.locator('tbody tr')).toHaveCount(3);
    await expect(pivoted).toContainText('华东');
  });

  test('按主题注入色板后重挂 viewer：图表照样出图、没有本站错误', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openReportPage(page);

    await card(page, '报表视图')
      .getByRole('button', { exact: true, name: '图表配色跟随当前主题' })
      .click();
    await expect(page.getByText('已注入 6 档色板')).toBeVisible();

    // 重挂之后两张图仍然画得出来：色板字符串必须能被 echarts 接受，否则这里就是 pageerror
    await expect(viewer(page).locator(WIDGET)).toHaveCount(6);
    for (const id of ['chart-region', 'chart-trend']) {
      const info = await inkedPixels(
        widget(page, id).locator('canvas').first(),
      );
      expect(info.inked, `${id} 重挂后画布空了`).toBeGreaterThan(10);
    }

    expect(errors.errors).toEqual([]);
  });
});
