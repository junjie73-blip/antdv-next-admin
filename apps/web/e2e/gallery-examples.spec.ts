import type { Locator, Page } from '@playwright/test';

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
 * 「组件示例」这一组的**交互契约**。
 *
 * `site-sweep.spec.ts` 已经替我们跑过一遍"打开不炸"，这里补的是"点了有没有反应"：
 * 这些页都是给别人抄的模板，模板写错 API 的典型症状恰好是"页面照样渲染、点了没反应"
 * （Tabs 的 `@add` 就是这么个哑炮），只靠巡检看不出来。
 *
 * 覆盖的是新页面里**只有浏览器能证伪**的那几条：
 * - `BasicTable` 的 `dragSort` / `dragSortConfig`（真拖一行，看 `tbody` 和数据谁先动）；
 * - `vue-draggable-plus` 的 `v-model` 与跨容器 `group`；
 * - 分步表单的门禁与"来回切步骤值不丢"；
 * - `useModal` / `useModalInner` 的数据通道与 `closeFunc` 拦截（含点蒙层只算一次关闭请求）；
 * - `<a-descriptions-item>` 这类**子组件写法**在 common-ui 里到底还在不在
 *   （解析失败只出 warning，表现是"那块内容是空的"，所以要数节点，不能只看标题）。
 *
 * 反过来说，这里也把**已经修好的能力钉成断言**（`setModalProps` 的覆盖层会真的重渲染标题、
 * 按钮文案和宽度）：那类结论一旦被"顺手改回去"，用例该红，所以写成断言而不是注释。
 */

const OVERVIEW = '/components/overview';
const DRAG_SORT = '/components/table/drag-sort';
const DRAG_LAYOUT = '/components/drag-layout';
const FORM_STEPS = '/components/form/steps';
const MODAL_DRAWER = '/components/modal-drawer';
const DESCRIPTION = '/components/description';
const DIRECTIVE = '/components/directive';

/**
 * 菜单 Demo 段的叶子数（`apps/backend-mock/server/api/menus.get.ts`，与
 * `apps/web/src/mock/fixtures.json` 的 `/menus` 是同一份数据的两个副本）：
 * 总览 1 + 表格 5 + 表单 4 + 二级散页 17 = 27，
 * 其中「示例总览」本页不进卡片墙（`SELF_PATH` 被过滤），所以墙上是 26 张卡。
 * 菜单叶子 → 卡片之间没有任何过滤（`status` / `permission` / `hidden` 都不参与，
 * 见 `packages/stores/src/route.ts` 的 `normalize`），所以加一页就是 +1 张卡。
 */
const OVERVIEW_CARD_COUNT = 26;

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

/** 按卡片标题取那一块卡片（`[data-slot="card"]` 是 shadcn Card 的根） */
function card(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/**
 * 同样按标题取卡，但只认标题那一行的**前缀**。
 * 新页面里有 `动态切换（编辑态 / 只读态）`、`嵌套与关闭拦截（closeFunc + 抽屉上叠弹窗）`
 * 这类带全角括号与代码片段的标题，整串抄进用例会因为一次排版改动就红。
 */
function cardByTitle(page: Page, prefix: string) {
  return page.locator('[data-slot="card"]').filter({
    has: page.locator('[data-slot="card-title"]', { hasText: prefix }),
  });
}

/**
 * 两字按钮的可访问名会被 antd 写成「成 功」（两个汉字之间插一个空格），
 * 所以这类名字一律用 `\s*` 容忍，不写死。三字以上不插。
 */
function cjkButton(scope: Page | ReturnType<typeof card>, label: string) {
  const pattern = new RegExp(`^${[...label].join(String.raw`\s*`)}$`);
  return scope.getByRole('button', { exact: true, name: pattern });
}

/**
 * 量一个"布局真的停住了"的包围盒。
 *
 * 整跑时这些路由是第一次进（dev 要现场编译整棵子树），入场动画 + 编译期补渲染会让
 * 落点在"跳"完之后才停到最终位置；起拖前不等稳，量到的坐标是动画中间帧，
 * Sortable 收到的 `onMove` 全落在错误的行上，表现成"两边计数原地不动"的假红
 * （热跑 4/4 成、冷跑偶发红，就是这个时机差）。
 */
async function settledBox(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  let previous = await locator.boundingBox();
  for (let step = 0; step < 20; step += 1) {
    await page.waitForTimeout(120);
    const next = await locator.boundingBox();
    if (
      previous &&
      next &&
      Math.abs(previous.x - next.x) < 1 &&
      Math.abs(previous.y - next.y) < 1 &&
      Math.abs(previous.height - next.height) < 1
    ) {
      return next;
    }
    previous = next;
  }
  throw new Error('落点/起点包围盒一直没停住');
}

/**
 * 跨容器互拖：把 `source` 拖进 `targetList` 这块容器的空白带。
 *
 * 不用一句 `dragTo` 了 —— 它只往落点**跳一次**再松手，只派发一次 pointermove，
 * 而 Sortable 需要看到落点里持续进来的 `onMove` 才会把 ghost 插进目标列表。
 * 这里按人的动作来：两边先等包围盒停稳，再走一串中间点，
 * 最后在容器底部空白处停两帧才松手。
 */
async function dragIntoList(page: Page, source: Locator, targetList: Locator) {
  const from = await settledBox(page, source);
  const to = await settledBox(page, targetList);
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  // 底部空白带：`min-h-[112px]` 给出来的那截，正是页面文案说的"空容器要给高度"
  const end = { x: to.x + 50, y: to.y + to.height - 10 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / 10,
      start.y + ((end.y - start.y) * step) / 10,
    );
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(150);
  await page.mouse.move(end.x + 2, end.y);
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/**
 * 表格行只认 `tbody tr[data-row-key]`。
 *
 * `BasicTable` 的行上同时挂着 `.basic-table-row` 与 `data-row-key`，而拖拽排序的
 * `oldIndex`/`newIndex` 是 Sortable 在 `tbody` 的**子节点**里数出来的；用例按同一个
 * 口径选行，才不会把非数据行（占位/空状态那类）算进下标。
 */
function tableRows(scope: Locator) {
  return scope.locator('tbody tr[data-row-key]');
}

/** 每行第 n 格的文字（压平空白），当作"页面上此刻呈现的顺序" */
function cellTexts(rows: Locator, cellIndex = 0) {
  return rows.evaluateAll(
    (els, cell) =>
      els.map((el) =>
        (el.querySelectorAll('td')[cell]?.textContent ?? '')
          .replaceAll(/\s+/g, ' ')
          .trim(),
      ),
    cellIndex,
  );
}

/** `VueDraggable` / 顺序标签那一行的条目文字 */
function itemTexts(items: Locator) {
  return items.evaluateAll((els) =>
    els.map((el) => (el.textContent ?? '').replaceAll(/\s+/g, ' ').trim()),
  );
}

/**
 * 按标题取那一个弹窗。
 *
 * 本页同时挂着 4 个 `BasicModal`，而且第 5 节的确认框是**叠在抽屉之上**开的，
 * 所以必须按标题分家；`.basic-modal` 是带宽度内联样式的那层，量尺寸也读它。
 */
function antModal(page: Page, title: string) {
  return page
    .locator('.basic-modal')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/** 按标题取那一个抽屉（`.basic-drawer` 是 DrawerContent 上的稳定类） */
function antDrawer(page: Page, title: string) {
  return page
    .locator('.basic-drawer')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/**
 * 卡片上的页面按钮，按文字取，不用 getByRole。
 *
 * 弹窗/抽屉开着的时候 `aria-modal` 会把页面其余部分整棵挡出无障碍树，
 * 角色选择器在那一刻数不到卡片按钮 —— 而 `clickPageButtonThroughMask`
 * 要的正是"遮罩还压着"的那个时刻。
 */
function cardButton(box: Locator, text: RegExp) {
  return box.locator('button').filter({ hasText: text }).first();
}

/**
 * 成功态结果块。
 * `Result` 把状态写在 `data-status` 上（不再有 `.ant-result-success` 这类状态类）。
 */
function resultBox(scope: Locator) {
  return scope.locator('[data-common-result][data-status="success"]');
}

/**
 * 抽屉贴在哪一边。
 *
 * 方位在 DOM 上只有 `data-swipe-direction`（值还是 up/down，不是 placement 的 top/bottom），
 * 落位靠对应的 `inset-*` 工具类，所以这里直接量面板与视口的关系：
 * 左右是通高（`inset-y-0`），上下是通宽。
 * `boundingBox()` 给的是 `{x, y, width, height}`，下沿要自己算 `y + height`。
 *
 * 量之前要等入场动画跑完：`data-[state=open]` 那条是 500ms 的 `slide-in-from-*`，
 * 途中读到的包围盒还在路上（实测底部抽屉第一帧 `y=717`，落定才是 `y=440`），
 * 左右方位则还带着 x 位移。动画末段是 ease-out、每帧只挪不到 1px，
 * 所以「两次读数相同」不算收敛 —— 要连着三次一样才收工。
 */
async function drawerSide(page: Page, panel: Locator) {
  let box = await panel.boundingBox();
  let stable = 0;
  const deadline = Date.now() + 3000;
  while (stable < 3 && Date.now() < deadline) {
    await page.waitForTimeout(100);
    const next = await panel.boundingBox();
    if (
      box &&
      next &&
      Math.abs(next.x - box.x) < 1 &&
      Math.abs(next.y - box.y) < 1 &&
      Math.abs(next.width - box.width) < 1 &&
      Math.abs(next.height - box.height) < 1
    ) {
      stable += 1;
    } else {
      stable = 0;
    }
    box = next ?? box;
  }
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('抽屉面板没有包围盒');
  if (Math.abs(box.height - viewport.height) <= 2) {
    return box.x <= 1 ? 'left' : 'right';
  }
  return Math.abs(box.y + box.height - viewport.height) < Math.abs(box.y)
    ? 'bottom'
    : 'top';
}

/**
 * 按住头部把面板往它的 swipe 方向拖出去 —— Drawer 比 Sheet 多出来的那条关闭路径。
 *
 * 起手点必须落在**非交互区**：`useSwipeDismiss` 看到手势起点在
 * `button / a / input / select / textarea / label / [role=button]` 上就放弃这次拖拽，
 * 所以头部标题那段 `span` 是唯一稳定的落点（右侧是关闭按钮，正文全是单选行）。
 * 左右方位从面板自己的 x 往视口内一侧起步，免得把指针拖出屏幕。
 *
 * 松手前必须**慢**：`useSwipeDismiss` 除了看位移是否过 40px 阈值，还会看释放速度
 * （每 80ms 内采样一次，方向速度 > 0.3px/ms 也算甩出）。一次 `steps: 6` 的快速拖拽
 * 哪怕只拖 20px 也会被速度判成关闭，所以这里拆成几段离散移动 + 每段之间等 40ms，
 * 松手前再停 200ms 让最后一次采样过期 —— 结论就只由位移是否过阈值决定。
 */
async function dragPanelOut(
  page: Page,
  panel: Locator,
  distance: number,
  fromTitleX = 80,
) {
  const box = await panel.evaluate(async (el) => {
    // 先等入场动画收干净再量：途中读到的包围盒还在屏幕外（实测左侧抽屉 x=-263），
    // 起点落在 overlay 上就变成"点蒙层关闭"，拖拽压根不会开始。
    await Promise.allSettled(
      (el as HTMLElement).getAnimations().map((anim) => anim.finished),
    );
    return (el as HTMLElement).getBoundingClientRect().toJSON();
  });
  const direction = await panel.getAttribute('data-swipe-direction');
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const startX = box.x + fromTitleX;
  const startY = box.y + 20;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 4;
  const per = distance / steps;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      startX + (horizontal ? sign * per * step : 0),
      startY + (horizontal ? 0 : sign * per * step),
    );
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
}

/**
 * 弹窗还开着的时候点**页面卡片上**的按钮。
 *
 * antd 的 `.basic-modal-wrap` 是一整屏的遮罩层，卡片按钮全在它下面，正常 click 会被
 * "subtree intercepts pointer events" 顶回来。这里要测的是页面自己那几个方法
 * （`getVisible()` / `closeModal()` / `setModalProps()`）在被调下去之后做了什么，
 * 不是"蒙层挡不挡得住鼠标"——那条路径由本页 X / 取消 / 蒙层几处用例覆盖。
 * 所以直接派发 click 事件，跳过命中测试。
 */
async function clickPageButtonThroughMask(button: Locator) {
  await button.evaluate((el) => (el as HTMLElement).click());
}

/**
 * `/components/description` 目前稳定吐两类**本站**的 console error（antd 把废弃提示和
 * 校验提示直接用 `console.error` 打出来，不是 warning，`watchErrors` 会把它们归进 `errors`）：
 * 1. `size="default"` 已废弃 —— `src/components/business/Description/Description.vue:150-152`
 *    把 `size` 的非 `small` 值一律映射成 `'default'`，antdv-next 1.6 只认 `'large'`。
 * 2. 一行 `span` 之和 ≠ `column` —— `src/views/components/description/index.vue` 的 schema
 *    里「配送备注」`span: 2`、「通信地址」`span: 3` 混在 `column: 3` 的表里凑不满整行。
 *
 * 这两条是缺陷，不是第三方噪音，所以不能塞进 `site-sweep.spec.ts` 那份
 * `VENDOR_CONSOLE_NOISE` 白名单（那份只收 vendor 包）；这里按原文逐条过滤、
 * 其余 error 依旧要求为空，两条缺陷已随本文件一起上报。
 */
const KNOWN_DESCRIPTION_ERRORS: RegExp[] = [
  /\[antd: Descriptions\].*is deprecated/,
  /Sum of column.*not match/,
];

function descriptionErrors(errors: string[]) {
  return errors.filter(
    (text) => !KNOWN_DESCRIPTION_ERRORS.some((pattern) => pattern.test(text)),
  );
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
    expect(totalCount).toBe(OVERVIEW_CARD_COUNT);
    // 页头那句「共 N 个示例」得和墙上的卡片对得上，否则说明分组统计漏了叶子
    await expect(
      page.getByText(`共 ${OVERVIEW_CARD_COUNT} 个示例`),
    ).toBeVisible();

    // 新页都在墙上：拖拽两条路（表格行 / 布局列表）、弹窗与抽屉、描述列表、分步表单
    for (const path of [
      DRAG_SORT,
      DRAG_LAYOUT,
      MODAL_DRAWER,
      DESCRIPTION,
      FORM_STEPS,
    ]) {
      await expect(overviewLink(page, path)).toBeVisible();
    }

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

test.describe('表格拖拽排序页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('整行拖拽：tbody 的行序与下方顺序标签一起变', async ({ page }) => {
    const errors = await open(page, DRAG_SORT);
    const box = card(page, '基础拖拽排序');
    const rows = tableRows(box);

    await expect(rows).toHaveCount(6);
    const initial = [
      '首页改版',
      '订单中心',
      '商品库',
      '库存同步',
      '数据报表',
      '系统设置',
    ];
    expect(await cellTexts(rows)).toEqual(initial);
    await expect(box.getByText('已调整 0 次')).toBeVisible();

    // 把第 1 行拖到第 3 行位置
    await rows.nth(0).dragTo(rows.nth(2));

    const moved = [
      '订单中心',
      '商品库',
      '首页改版',
      '库存同步',
      '数据报表',
      '系统设置',
    ];
    await expect
      .poll(() => cellTexts(rows), { message: '渲染出来的行序要真的换位' })
      .toEqual(moved);
    // 数据侧：顺序标签读的是 `basicList`（onDragEnd 写回的 ref），
    // 只有 DOM 变了而标签没变，才说明 Sortable 的下标和数据源对不上
    const tags = box.locator('.mt-3 [data-common-tag]');
    await expect
      .poll(() => itemTexts(tags), { message: '顺序标签要跟着数据源变' })
      .toEqual([
        '1. 订单中心',
        '2. 商品库',
        '3. 首页改版',
        '4. 库存同步',
        '5. 数据报表',
        '6. 系统设置',
      ]);
    await expect(box.getByText('已调整 1 次')).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('手柄变体只认 ⠿：从行文字上拖不动', async ({ page }) => {
    const errors = await open(page, DRAG_SORT);
    const box = card(page, '手柄拖拽');
    const rows = tableRows(box);
    const initial = [
      '快捷入口',
      '消息通知',
      '常用报表',
      '审批流模板',
      '帮助文档',
    ];

    await expect(rows).toHaveCount(5);
    // 折叠/入场动画还在跑的时候读一次是会被打脸的，轮询到初始顺序自洽再起拖
    await expect
      .poll(() => cellTexts(rows, 1), { message: '手柄卡没按初始顺序画出来' })
      .toEqual(initial);

    /*
     * 抓把手 ⠿ 拖：换位。
     *
     * 两端先等包围盒停稳再起拖（见 `settledBox`）—— 实测 `dragTo` 这条原生 HTML5 拖拽
     * 链路本身是稳的（同一手势连跑每次都换位），整跑的偶发红全来自"量到动画中间帧的坐标"：
     * 行还在往下挪时松手，`oldIndex` 与 `newIndex` 相同，`useDragSort` 的 `onEnd` 直接 return，
     * 于是数据原地不动，`expect.poll` 干等满 10s。
     */
    const dragHandle = async (from: Locator, to: Locator) => {
      await settledBox(page, from);
      await settledBox(page, to);
      await from.dragTo(to);
    };

    await dragHandle(
      rows.nth(0).locator('.drag-handle'),
      rows.nth(2).locator('.drag-handle'),
    );
    await expect
      .poll(() => cellTexts(rows, 1), { message: '从把手拖要能换位' })
      .toEqual(['消息通知', '常用报表', '快捷入口', '审批流模板', '帮助文档']);

    // 从第二格（功能块文字）拖：`handle` 不匹配 → 一行都不该动
    await dragHandle(
      rows.nth(0).locator('td').nth(1),
      rows.nth(2).locator('td').nth(1),
    );
    await expect
      .poll(() => cellTexts(rows, 1), { message: '不是把手就不该起拖' })
      .toEqual(['消息通知', '常用报表', '快捷入口', '审批流模板', '帮助文档']);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  /**
   * 「禁止某些行被拖动 / 禁止落点」那张卡的三条约束。
   *
   * 三条都靠 `packages/core/ui-kit/table-ui/src/hooks/useDragSort.ts` 兜住，各自的落点不同：
   * 1. 函数形态与布尔形态的 `disabled` 都走 Sortable 的 `filter`——它是每次按下都重新问一次的
   *    真闸门；早先把判定写在 `onStart` 里 `preventDefault()` + `return false`，而 Sortable
   *    派发用户回调时（`EventDispatcher.js`）压根不看返回值，于是禁用行照样拖得动。
   * 2. `canDrop` 走 `onMove`，用事件上的 `dragged` / `related` 两个 `<tr>` 认行——
   *    Sortable 给 `onMove` 的事件没有下标字段，只能拿元素反查记录。
   *    另外落点约束不只判"落到的那一行"，还判这一步跨过的那几行：`dragTo` 是一步到位的手势，
   *    中间行根本不会被 hover，不判路径就永远拦不住"跨越锁定行"。
   *
   * 这三条在 jsdom 里已由 `packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts` 逐条断言，
   * 这里要的是真实浏览器里的原生拖拽链路。
   */
  test('整表冻结 / 置顶行不可拖 / 落点不可越线：三条约束都拦得住', async ({
    page,
  }) => {
    const errors = await open(page, DRAG_SORT);
    const box = cardByTitle(page, '禁止某些行被拖动');
    const rows = tableRows(box);
    const initial = [
      '置顶公告',
      '活动 Banner',
      '新人指南',
      '系统基线',
      '版本说明',
      '常见问题',
    ];

    await expect(rows).toHaveCount(6);
    expect(await cellTexts(rows)).toEqual(initial);

    // 对照组：不涉及 pinned / locked 的相邻拖拽，这张卡是真的绑上了 Sortable
    await settledBox(page, rows.nth(4));
    await settledBox(page, rows.nth(5));
    await rows.nth(4).dragTo(rows.nth(5));
    await expect
      .poll(() => cellTexts(rows), { message: '普通相邻行要能换位' })
      .toEqual([
        '置顶公告',
        '活动 Banner',
        '新人指南',
        '系统基线',
        '常见问题',
        '版本说明',
      ]);

    // 函数形态 `disabled`：置顶公告标着「置顶 · 不可拖动」，不该被拖走
    await settledBox(page, rows.nth(0));
    await settledBox(page, rows.nth(1));
    await rows.nth(0).dragTo(rows.nth(1));
    await expect
      .poll(() => cellTexts(rows), { message: 'pinned 行不该起拖' })
      .toEqual([
        '置顶公告',
        '活动 Banner',
        '新人指南',
        '系统基线',
        '常见问题',
        '版本说明',
      ]);

    // `canDrop`：第 5 行要往前挪到「活动 Banner」那一格，路径上必须经过锁定的
    // 「系统基线」，一步到位的手势也要被拦下（落点约束覆盖被跨过的每一行）
    await settledBox(page, rows.nth(4));
    await settledBox(page, rows.nth(1));
    await rows.nth(4).dragTo(rows.nth(1));
    await expect
      .poll(() => cellTexts(rows), { message: '不能越过 locked 行' })
      .toEqual([
        '置顶公告',
        '活动 Banner',
        '新人指南',
        '系统基线',
        '常见问题',
        '版本说明',
      ]);

    // 布尔形态 `disabled: true`：整表冻结后任何一行都拖不动
    const freeze = box.locator('[role="switch"]');
    await freeze.click();
    await expect(freeze).toHaveAttribute('data-state', 'checked');
    await settledBox(page, rows.nth(1));
    await settledBox(page, rows.nth(2));
    await rows.nth(1).dragTo(rows.nth(2));
    await expect
      .poll(() => cellTexts(rows), { message: '整表冻结后行序不该动' })
      .toEqual([
        '置顶公告',
        '活动 Banner',
        '新人指南',
        '系统基线',
        '常见问题',
        '版本说明',
      ]);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('保存顺序：初始就是脏的，点保存翻正，再拖一次又变脏', async ({
    page,
  }) => {
    const errors = await open(page, DRAG_SORT);
    const box = card(page, '保存顺序');
    const rows = tableRows(box);
    const cleanTag = box.getByText('顺序与已保存一致');
    const dirtyTag = box.getByText('有未保存的改动');
    const saveButton = cjkButton(box, '保存顺序');

    await expect(rows).toHaveCount(5);

    // 页面把 `savedOrder` 的初值留成空串，所以"没存过"本身就是脏态：
    // 脏标在、按钮可点、那行状态还写着「尚未保存」——这才是模板要演示的起点
    const initial = ['轮播图', '热门榜单', '最近更新', '编辑精选', '页脚导航'];
    expect(await cellTexts(rows)).toEqual(initial);
    await expect(dirtyTag).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await expect(
      box.getByText('最近一次保存（本地 ref）：尚未保存'),
    ).toBeVisible();

    // 存的是当前 id 序列：1..5 原样落进页面状态，脏标记与按钮一起翻正
    await saveButton.click();
    await expect(cleanTag).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(
      box.getByText('最近一次保存（本地 ref）：1,2,3,4,5'),
    ).toBeVisible();

    // 拖一步：把首行挪到第 4 格 → id 序列变成 2,3,4,1,5，脏标回来
    await rows.nth(0).dragTo(rows.nth(3));
    await expect
      .poll(() => cellTexts(rows), { message: '拖完行序要换位' })
      .toEqual(['热门榜单', '最近更新', '编辑精选', '轮播图', '页脚导航']);
    await expect(dirtyTag).toBeVisible();
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(cleanTag).toBeVisible();
    await expect(
      box.getByText('最近一次保存（本地 ref）：2,3,4,1,5'),
    ).toBeVisible();
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: '已保存 5 条顺序' })
        .first(),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });
});

test.describe('拖拽布局页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('v-model 列表：拖动换序后顺序标签一起变', async ({ page }) => {
    const errors = await open(page, DRAG_LAYOUT);
    const box = card(page, '基础列表拖拽');
    const rows = box.locator('.space-y-2 > div');

    await expect(rows).toHaveCount(6);
    const initial = [
      '1. 待办审批',
      '2. 数据看板',
      '3. 客户列表',
      '4. 工单中心',
      '5. 消息中心',
      '6. 系统设置',
    ];
    await expect
      .poll(async () => itemTexts(box.locator('.mt-4 [data-common-tag]')))
      .toEqual(initial);

    await rows.nth(0).dragTo(rows.nth(2));

    // 标签行读的就是 `v-model` 那份数组：DOM 与数据不一致时这里先红
    await expect
      .poll(async () => itemTexts(box.locator('.mt-4 [data-common-tag]')), {
        message: 'VueDraggable 要在 update 里把数组 splice 好',
      })
      .toEqual([
        '1. 数据看板',
        '2. 客户列表',
        '3. 待办审批',
        '4. 工单中心',
        '5. 消息中心',
        '6. 系统设置',
      ]);
    await expect
      .poll(() => itemTexts(rows), { message: '渲染出来的行序也要同步' })
      // 序号、名称、说明是三个紧挨着的 `<span>`，中间没有空白文本节点，
      // 压平空白后拿到的是 `1数据看板GMV / 订单量 / 转化率`
      // （只有说明文字自带的空格保留），照抄 DOM 拼出来的样子断言。
      .toEqual([
        '1数据看板GMV / 订单量 / 转化率',
        '2客户列表带跟进状态与标签筛选',
        '3待办审批按发起人聚合，默认在第一屏',
        '4工单中心超时未处理置顶提醒',
        '5消息中心站内信与推送开关',
        '6系统设置仅管理员可见',
      ]);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('手柄变体只认 ⠿，从行文字上拖不动', async ({ page }) => {
    const errors = await open(page, DRAG_LAYOUT);
    const box = card(page, '手柄拖拽');
    const rows = box.locator('.space-y-2 > div');
    const names = async () =>
      rows.evaluateAll((els) =>
        els.map((el) =>
          (el.querySelector('.font-medium')?.textContent ?? '').trim(),
        ),
      );

    await expect(rows).toHaveCount(5);
    const initial = [
      '月度经营分析',
      '渠道投放复盘',
      '库存周报',
      '客服质检抽样',
      '大促作战地图',
    ];
    expect(await names()).toEqual(initial);

    // 从 note 文字上拖：`handle: '.drag-grip'` 不匹配 → 不该换位
    await rows
      .nth(0)
      .dragTo(rows.nth(2), { sourcePosition: { x: 300, y: 20 } });
    await expect
      .poll(names, { message: '不是把手就不该起拖' })
      .toEqual(initial);

    await rows
      .nth(0)
      .locator('.drag-grip')
      .dragTo(rows.nth(2).locator('.drag-grip'));
    await expect
      .poll(names, { message: '抓把手要换位' })
      .toEqual([
        '渠道投放复盘',
        '库存周报',
        '月度经营分析',
        '客服质检抽样',
        '大促作战地图',
      ]);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('跨容器互拖：两个 v-model 的计数都真的变了', async ({ page }) => {
    const errors = await open(page, DRAG_LAYOUT);
    const box = card(page, '两个列表互拖');
    // 两个面板靠 `border-dashed` 分家（待选 / 已选）
    const panels = box.locator('.border-dashed');
    const candidate = panels.nth(0);
    const chosen = panels.nth(1);
    const candidateItems = candidate.locator('.space-y-2 > div');
    const chosenItems = chosen.locator('.space-y-2 > div');

    await expect(candidateItems).toHaveCount(5);
    await expect(chosenItems).toHaveCount(2);
    await expect(box.getByText('5 项', { exact: true })).toBeVisible();
    await expect(box.getByText('2 项', { exact: true })).toBeVisible();

    /**
     * 落点给**目标列表的容器**（`min-h-[112px]` 那块空白），而不是给某一条已选条目：
     * 实测落在条目上时这条跨容器路径不落进去（`remove`/`add` 都不派发，两边计数原地不动），
     * 而页面自己那段文案强调的恰好是"空容器要给高度，否则接不住落点"。
     */
    await dragIntoList(
      page,
      candidateItems.nth(0),
      chosen.locator('.space-y-2'),
    );

    // 库按 remove / add 两个事件分别改两份数组，所以两边都要动一个
    await expect
      .poll(() => candidateItems.count(), { message: '源数组要少一条' })
      .toBe(4);
    await expect
      .poll(() => chosenItems.count(), { message: '目标数组要多一条' })
      .toBe(3);
    // 搬过去的必须是那一条，且源数组里从此没有它（两份 v-model 各自都是准的）
    await expect(chosenItems.filter({ hasText: '销售额趋势' })).toHaveCount(1);
    await expect(candidateItems.filter({ hasText: '销售额趋势' })).toHaveCount(
      0,
    );
    await expect(box.getByText('4 项', { exact: true })).toBeVisible();
    await expect(box.getByText('3 项', { exact: true })).toBeVisible();

    // 还原示例数据：回到 5 / 2，证明计数读的是那两份 ref 而不是 DOM 残影
    await box.getByRole('button', { name: /还原示例数据/ }).click();
    await expect(candidateItems).toHaveCount(5);
    await expect(chosenItems).toHaveCount(2);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});

test.describe('分步表单页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * 按标签取字段控件，**必须圈在卡片里**：这一页第 2 张卡也有「手机号 / 邮箱」同名字段，
   * 从 page 上取会撞 strict mode。
   *
   * `FormItem` 给每个字段生成一个 `useId()`，标签写成 `<label for=那个 id>`，字段组件
   * 把同一个 id 落在自己的 `data-field-control` 节点上，所以这里一律走 `getByLabel` ——
   * 它同时覆盖 Input / InputTextArea / Select 的可关联控件，不必再按 DOM 结构去拼 CSS
   * （`filter({ has: box.locator('label') })` 那种写法会在子树里重新解析选择器，实测命中 0 个）。
   */
  function field(scope: Locator, label: string) {
    return scope.getByLabel(label, { exact: true });
  }

  /**
   * 取那一个 `Select` 的触发按钮。
   *
   * form-ui 的 Select 是 `Popover` + `role=combobox` 的按钮，不是 antd 的 `.ant-select`，
   * 而这一页第 1 步只有它一个 combobox，所以按角色数就够。
   */
  function combobox(scope: Locator) {
    return scope.locator('[role="combobox"]');
  }

  /** 选项面板挂在 body 上（Popover 传送到根节点），不能圈在卡片里找 */
  function option(page: Page, text: string) {
    return page
      .locator('[data-slot="popover-content"] button')
      .filter({ hasText: text })
      .first();
  }

  test('「下一步」被必填拦住时原地停住，补全后才过去', async ({ page }) => {
    const errors = await open(page, FORM_STEPS);
    const box = card(page, '基础分步表单');
    const meta = box.getByText(/页面已攒/);

    await expect(meta).toContainText('第 1/3 步 · 页面已攒 0 个字段');

    // 什么都不填直接下一步：门禁要挡住，步骤号不许动
    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 1/3 步 · 页面已攒 0 个字段');
    await expect(cjkButton(box, '提交')).toHaveCount(0);
    // 两个必填（真实姓名 / 证件类型）各出一条行内错误，文案是 Form 的默认必填语
    const explains = box.locator('.form-item-error');
    await expect(explains).toHaveCount(2);
    expect(await explains.allTextContents()).toEqual([
      '该项为必填项',
      '该项为必填项',
    ]);
    // 页面还会把失败原因播报成一句 message（前缀是这一步的标题）
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: '「基本信息」：该项为必填项' }),
    ).toBeVisible();

    await field(box, '真实姓名').fill('张伟');
    // 第 1 步只有一个 Select，选项面板挂在 body 上，不能圈在卡片里找
    await expect(combobox(box)).toHaveCount(1);
    await combobox(box).click();
    await option(page, '身份证').click();
    await expect(explains).toHaveCount(0);

    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 2/3 步 · 页面已攒 2 个字段');

    // 第 2 步的手机号格式在本步就拦（不是必填拦住，是 pattern 规则）
    await field(box, '手机号').fill('1234');
    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 2/3 步');
    expect(await box.locator('.form-item-error').allTextContents()).toEqual([
      '11 位手机号，别带空格',
    ]);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('来回切步骤值不丢，提交后的摘要是全量字段', async ({ page }) => {
    const errors = await open(page, FORM_STEPS);
    const box = card(page, '基础分步表单');
    const meta = box.getByText(/页面已攒/);

    // 第 1 步：三个字段都填（昵称选填，用来验证「已攒」计数确实数的是值）
    await field(box, '真实姓名').fill('张伟');
    await field(box, '昵称').fill('小张');
    await combobox(box).click();
    await option(page, '护照').click();
    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 2/3 步 · 页面已攒 3 个字段');

    await field(box, '手机号').fill('13800138000');
    await field(box, '邮箱').fill('zhangsan@example.com');

    // 倒退不校验，且把已经填的第 2 步值一起收进页面状态 → 计数涨到 5
    await cjkButton(box, '上一步').click();
    await expect(meta).toContainText('第 1/3 步 · 页面已攒 5 个字段');
    await expect(field(box, '真实姓名')).toHaveValue('张伟');
    await expect(field(box, '昵称')).toHaveValue('小张');

    // 再往前：第 2 步的值也在（`setProps({ schemas })` 不动 formModel 的意思）
    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 2/3 步 · 页面已攒 5 个字段');
    await expect(field(box, '手机号')).toHaveValue('13800138000');
    await expect(field(box, '邮箱')).toHaveValue('zhangsan@example.com');

    await field(box, '通讯地址').fill('北京市朝阳区建国路 88 号');
    await cjkButton(box, '下一步').click();
    await expect(meta).toContainText('第 3/3 步 · 页面已攒 6 个字段');

    // 服务协议是 RadioGroup，不点则提交会被整表校验拦回第 3 步
    await cjkButton(box, '提交').click();
    await expect(meta).toContainText('第 3/3 步');
    await expect(resultBox(box)).toHaveCount(0);
    expect(await box.locator('.form-item-error').allTextContents()).toEqual([
      '需要先同意《用户服务协议》',
    ]);

    await box.locator('label').filter({ hasText: '我已阅读并同意' }).click();
    await cjkButton(box, '提交').click();

    /**
     * 结果页这一段同时是**子组件写法**的证据：`Result` 里的摘要用的是
     * `<Descriptions><DescriptionsItem v-for>…</DescriptionsItem></Descriptions>`
     * 这种**内容式子标签**，而不是业务组件 `Description` 的 `items` 配置。
     * 这类写法一旦注册漏了就只有一条 warning、节点静默变空 —— 所以这里逐格数标签与值。
     */
    const result = resultBox(box);
    await expect(result).toBeVisible();
    await expect(result).toContainText('分步表单已提交');
    const labels = result.locator('[data-common-descriptions-label]');
    const contents = result.locator('[data-common-descriptions-value]');
    await expect(labels).toHaveCount(8);
    expect(await labels.allTextContents()).toEqual([
      '真实姓名',
      '昵称',
      '证件类型',
      '手机号',
      '邮箱',
      '通讯地址',
      '服务协议',
      '备注',
    ]);
    // Select / RadioGroup 的中文标签是从 componentProps.options 反查出来的，
    // 直接打印 value 会是 passport / agree；没填的备注落到「—」
    expect(await contents.allTextContents()).toEqual([
      '张伟',
      '小张',
      '护照',
      '13800138000',
      'zhangsan@example.com',
      '北京市朝阳区建国路 88 号',
      '我已阅读并同意《用户服务协议》',
      '—',
    ]);

    // 重新填写：回到第 1 步空表，计数归零
    await cjkButton(box, '重新填写').click();
    await expect(meta).toContainText('第 1/3 步 · 页面已攒 0 个字段');
    await expect(field(box, '真实姓名')).toHaveValue('');

    expect(
      errors.warnings.filter((text) =>
        text.includes('Failed to resolve component'),
      ),
    ).toEqual([]);
    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });
});

test.describe('弹窗与抽屉页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('openModal(true, data) 把数据送进 useModalInner 回调，提交时整份回传', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '基础弹窗');

    await box.getByRole('button', { name: /打开并传数据/ }).click();
    const modal = antModal(page, '编辑用户信息');
    await expect(modal).toBeVisible();
    // 回调只跑一次，且收到的就是父页面那份对象
    await expect(
      modal.getByText(/useModalInner 回调第 1 次收到数据/),
    ).toBeVisible();
    await expect(
      modal.getByText(/这段数据由父页面 openModal\(true, data\) 传入/),
    ).toBeVisible();
    await expect(modal.getByPlaceholder('请输入姓名')).toHaveValue('张三');
    await expect(modal.getByText('数据 ID：', { exact: false })).toBeVisible();
    // 函数属性不进 JSON：展示的是纯数据部分
    await expect(modal.getByText('"onSubmit"')).toHaveCount(0);

    // 改一个字段再提交，回传的要是当前值而不是初始值
    await modal.getByPlaceholder('请输入部门').fill('平台组');
    await cjkButton(modal, '提交').click();
    await expect(modal).toBeHidden();

    const back = box.locator('pre').nth(1);
    await expect(back).toContainText('"department": "平台组"');
    await expect(back).toContainText('"name": "张三"');
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: '弹窗已把表单回传到示例页' }),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('取消、closeModal() 两条关得掉，getVisible() 说的是实话', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '基础弹窗');
    const probe = box.locator('p').filter({ hasText: '方法返回值' });
    const openButton = cardButton(box, /打开并传数据/);
    const probeButton = cardButton(box, /getVisible\(\) 查询显隐/);
    const closeButton = cardButton(box, /closeModal\(\) 关闭/);
    const modal = antModal(page, '编辑用户信息');

    await openButton.click();
    await expect(modal).toBeVisible();
    // 开着的时候读 getVisible()：蒙层挡住鼠标，见 `clickPageButtonThroughMask` 的说明
    await clickPageButtonThroughMask(probeButton);
    await expect(probe).toContainText('getVisible() = true');

    // 内置底部的「取消」
    await cjkButton(modal, '取消').click();
    await expect(modal).toBeHidden();
    await probeButton.click();
    await expect(probe).toContainText('getVisible() = false');

    // 父页面的 closeModal()：再开一次，用它关掉，页面同时播报一条 message
    await openButton.click();
    await expect(modal).toBeVisible();
    await clickPageButtonThroughMask(closeButton);
    await expect(modal).toBeHidden();
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: '已调用 useModal().closeModal()' }),
    ).toBeVisible();
    // 关掉之后 closeModal() 是幂等的：再点一次不报错、状态还是关
    await closeButton.click();
    await expect(modal).toBeHidden();
    await probeButton.click();
    await expect(probe).toContainText('getVisible() = false');

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  /**
   * `setModalProps` 的生效回归位。
   *
   * BasicModal 不写只读的 `defineProps`，而是把覆盖值并进组件内部的 `propOverrides`，
   * 渲染统一读 `merged`，所以标题、确认按钮文案、宽度都会当场翻正。
   * 页面把这条结论如实打在日志里，用例把它钉住：哪天覆盖层被改坏了，这里就该红。
   */
  test('setModalProps 生效：标题、按钮文案、宽度都按覆盖值重渲染', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '基础弹窗');

    await box.getByRole('button', { name: /打开并传数据/ }).click();
    await expect(antModal(page, '编辑用户信息')).toBeVisible();
    await expect(antModal(page, '编辑用户信息')).toHaveAttribute(
      'style',
      /520px/,
    );

    // 弹窗开着的时候卡片上那几个按钮全在遮罩层下面，
    // 本段要证的是「setModalProps 被调下去之后 props 有没有变」，
    // 遮罩挡鼠标那条路径另有 X / 取消 / 蒙层三处用例覆盖，这里直接派发 click。
    await clickPageButtonThroughMask(cardButton(box, /尝试改 props/));

    // 标题换了之后原来的锚点就没了，按新标题重新定位
    const renamed = antModal(page, '标题被 setModalProps 改掉');
    await expect(renamed).toBeVisible();
    await expect(
      renamed.getByText('编辑用户信息', { exact: true }),
    ).toHaveCount(0);
    await expect(cjkButton(renamed, '确认修改')).toBeVisible();
    await expect(renamed.getByRole('button', { name: /^提交$/ })).toHaveCount(
      0,
    );
    await expect(renamed).toHaveAttribute('style', /640px/);

    // 页面自己也这么说
    await expect(
      box.getByText(/标题\/按钮\/宽度已按覆盖值重渲染/),
    ).toBeVisible();
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: 'props 覆盖层已生效' }),
    ).toBeVisible();
    // getVisible() 仍然是真的
    await clickPageButtonThroughMask(
      cardButton(box, /getVisible\(\) 查询显隐/),
    );
    await expect(
      box.locator('p').filter({ hasText: '方法返回值' }),
    ).toContainText('getVisible() = true');

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('三种方位的抽屉都能打开，footer 插槽的按钮把值写回页面', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '抽屉基础与位置');
    const result = box
      .locator('div')
      .filter({ hasText: /^左侧抽屉|^右侧抽屉|^底部抽屉/ });

    // 左：#footer 插槽替掉了内置按钮，「应用」写状态并关闭
    await box.getByRole('button', { name: /左侧抽屉/ }).click();
    const left = antDrawer(page, '左侧抽屉 · 布局密度');
    expect(await drawerSide(page, left), '左侧抽屉应贴在视口左边').toBe('left');
    await left.locator('label').filter({ hasText: '紧凑' }).click();
    await left.getByRole('button', { name: /应用/ }).click();
    await expect(left).toBeHidden();
    await expect(
      page.getByText(/左侧抽屉（:width="360"）→ 密度 = compact/),
    ).toBeVisible();

    // 左：取消不改页面状态（还是 compact）
    await box.getByRole('button', { name: /左侧抽屉/ }).click();
    await left.locator('label').filter({ hasText: '宽松' }).click();
    await cjkButton(left, '取消').click();
    await expect(left).toBeHidden();
    await expect(page.getByText(/密度 = compact$/)).toBeVisible();
    await expect(result).not.toContainText('宽松');

    // 右：默认方位，footer 里的「全选」是插槽按钮，只有回写状态才会带出五个模块
    await box.getByRole('button', { name: /右侧抽屉/ }).click();
    const right = antDrawer(page, '右侧抽屉 · 模块选择');
    expect(await drawerSide(page, right), '右侧抽屉贴右').toBe('right');
    await right.getByRole('button', { name: /全选/ }).click();
    await expect(
      right.locator('[role="checkbox"][data-state="checked"]'),
    ).toHaveCount(5);
    await right.getByRole('button', { name: /完成/ }).click();
    await expect(right).toBeHidden();
    await expect(
      page.getByText(
        /右侧抽屉（:size="520"）→ 已选模块 = system、monitor、report、schedule、notice/,
      ),
    ).toBeVisible();

    // 底：placement 决定取 height 而不是 width
    await box.getByRole('button', { name: /底部抽屉/ }).click();
    const bottom = antDrawer(page, '底部抽屉 · 过渡时长');
    expect(await drawerSide(page, bottom), '底部抽屉贴下沿').toBe('bottom');
    await bottom.locator('label').filter({ hasText: '400ms' }).click();
    await bottom.getByRole('button', { name: /应用/ }).click();
    await expect(bottom).toBeHidden();
    await expect(
      page.getByText(/底部抽屉（:height="280"）→ 过渡时长 = 400ms/),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  /**
   * Drawer 的原生手势：拖过阈值就关，没拖到或 `closeFunc` 拦着都弹回原位。
   * 这条路径只走 `update:open(false, { reason: 'swipe' })`，
   * 所以它既不该绕过 `closeFunc`，也不该把面板留在屏幕外。
   */
  test('拖头部甩出抽屉：没到阈值弹回，closeFunc 照样拦得住', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '抽屉基础与位置');

    await box.getByRole('button', { name: /左侧抽屉/ }).click();
    const left = antDrawer(page, '左侧抽屉 · 布局密度');
    await expect(left).toBeVisible();

    // 20px < 40px 阈值 → 不算关闭请求
    await dragPanelOut(page, left, 20);
    await expect(left, '没到阈值不该关').toBeVisible();
    expect(await drawerSide(page, left), '弹回后仍贴左边').toBe('left');

    // 70px > 阈值 → 甩出，走的是和 X 按钮同一条关闭链
    await dragPanelOut(page, left, 70);
    await expect(left).toBeHidden();

    // 脏草稿 + 甩出：先 cancel() 把面板拉回来，关不关交给 closeFunc
    const nest = cardByTitle(page, '嵌套与关闭拦截');
    await nest.getByRole('button', { name: '打开可编辑抽屉' }).click();
    const draft = antDrawer(page, '草稿编辑（关闭前会过 closeFunc）');
    await draft.locator('textarea').fill('拖一下试试');
    await expect(nest.getByText('有未保存修改')).toBeVisible();
    await dragPanelOut(page, draft, 70);
    await expect(draft, 'closeFunc 要拦得住甩出').toBeVisible();
    await expect(nest.getByText('拦截 1 次')).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('closeFunc：草稿脏时底部、X、蒙层三条路都被拦下，放弃修改后放行', async ({
    page,
  }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '嵌套与关闭拦截');

    await box.getByRole('button', { name: '打开可编辑抽屉' }).click();
    const drawer = antDrawer(page, '草稿编辑（关闭前会过 closeFunc）');
    await expect(drawer).toBeVisible();
    await expect(box.getByText('内容已保存')).toBeVisible();

    // 干净状态下直接关得掉，顺带证明 closeFunc 不是一律拦
    await drawer.getByRole('button', { name: /关闭抽屉/ }).click();
    await expect(drawer).toBeHidden();
    await expect(
      box.getByText('第 1 次关闭请求：内容干净，直接放行'),
    ).toBeVisible();

    // 改脏 → 底部「关闭抽屉」被拦，并叠出确认框
    await box.getByRole('button', { name: '打开可编辑抽屉' }).click();
    await expect(drawer).toBeVisible();
    await drawer.locator('textarea').fill('又改了几个字');
    await expect(box.getByText('有未保存修改')).toBeVisible();

    const confirm = antModal(page, '关闭被拦截了');
    await drawer.getByRole('button', { name: /关闭抽屉/ }).click();
    await expect(drawer).toBeVisible();
    await expect(confirm).toBeVisible();
    await expect(box.getByText('拦截 1 次')).toBeVisible();
    await cjkButton(confirm, '留在页面').click();
    await expect(confirm).toBeHidden();
    await expect(drawer).toBeVisible();

    // X 与蒙层最后都走 closeDrawer()，所以同一条 closeFunc 一样拦得住
    await drawer.locator('button[aria-label^="关闭"]').click();
    await expect(drawer).toBeVisible();
    await expect(confirm).toBeVisible();
    await cjkButton(confirm, '留在页面').click();
    await page.locator('[data-slot="drawer-overlay"]').last().click();
    await expect(drawer).toBeVisible();
    await expect(confirm).toBeVisible();
    await expect(box.getByText('拦截 3 次')).toBeVisible();

    // 放弃修改：先把内容改回已保存值，关闭请求自然放行
    await cjkButton(confirm, '放弃修改并关闭').click();
    await expect(confirm).toBeHidden();
    await expect(drawer).toBeHidden();
    await expect(box.getByText('内容已保存')).toBeVisible();
    await expect(box.getByText('草稿已保存，抽屉关闭')).toHaveCount(0);

    expect(errors.errors).toEqual([]);
    errors.stop();
  });

  test('抽屉内滚动：没读到底就点不动「同意并关闭」', async ({ page }) => {
    const errors = await open(page, MODAL_DRAWER);
    const box = cardByTitle(page, '抽屉内滚动');
    const ok = cjkButton(box, '打开长内容抽屉');
    await ok.click();

    const drawer = antDrawer(page, '抽屉内滚动 · 协议确认');
    await expect(drawer).toBeVisible();
    // 内置底部的确认按钮由 okButtonProps 驱动：没勾同意就一直是禁用态
    const footer = drawer.locator('.drawer-footer');
    await expect(
      footer.getByRole('button', { name: /同意并关闭/ }),
    ).toBeDisabled();

    // 嵌套 Scrollbar 的滚动位置是 @scroll 事件写回页面状态的
    // （抽屉正文自己那层是 ScrollArea，不带 `.scrollbar__wrap`，所以这里只有一个）
    const inner = drawer.locator('.scrollbar__wrap').first();
    await inner.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(drawer.getByText('已到底部')).toBeVisible();
    await drawer.getByText('我已阅读完附加条款').click();
    await expect(
      footer.getByRole('button', { name: /同意并关闭/ }).first(),
    ).toBeEnabled();

    await footer.getByRole('button', { name: /同意并关闭/ }).click();
    await expect(drawer).toBeHidden();
    await expect(
      box.getByText(/已阅读并同意（内部 Scrollbar 滚动位置 \d+px）/),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});

test.describe('描述列表页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('子组件写法与三档取值都真的渲染出了内容', async ({ page }) => {
    const errors = await open(page, DESCRIPTION);

    const basic = card(page, '基础描述列表');
    // 解析失败的组件只会静默变成空节点，所以按标签格数数：schema 写几条就该有几条
    await expect(basic.locator('[data-common-descriptions-label]')).toHaveCount(
      9,
    );
    await expect(basic.getByText('用户基本信息')).toBeVisible();
    await expect(basic.getByText('张伟')).toBeVisible();
    // type: 'date' / 'datetime' 走 dayjs 格式化
    await expect(basic.getByText('1996-05-15')).toBeVisible();
    await expect(basic.getByText('2024-01-15 10:30:00')).toBeVisible();
    // 空值落到 emptyText，而不是留一个空格子（标签带冒号，按 data 属性定位才稳）
    const homepage = basic
      .locator('[data-common-descriptions-item]')
      .filter({ hasText: '个人主页' });
    await expect(
      homepage.locator('[data-common-descriptions-value]'),
    ).toHaveText('-');
    expect(
      await basic
        .locator('[data-common-descriptions-value]')
        .filter({ hasText: /^-$/ })
        .count(),
    ).toBeGreaterThanOrEqual(1);

    const renderBox = card(page, '值渲染与插槽');
    await expect(
      renderBox.locator('[data-common-descriptions-label]'),
    ).toHaveCount(6);
    // type: image(1) + images(2) 一共三张可预览图，节点没解析出来就是 0
    await expect(renderBox.locator('[data-common-image]')).toHaveCount(3);
    // render 函数返回的 Tag
    await expect(
      renderBox.locator('[data-common-tag]').filter({ hasText: '在职' }),
    ).toHaveCount(1);
    // 具名插槽 #skills：四个技能标签
    await expect(
      renderBox
        .locator('[data-common-tag]')
        .filter({ hasText: 'Tailwind CSS' }),
    ).toHaveCount(1);
    // 标签插槽 #department-label 把「所属部门」换成了带图标的蓝字
    await expect(renderBox.getByText('所属部门')).toBeVisible();
    // 插槽 #email 包的是「code + 复制按钮」，值格子里必须能读到邮箱原文
    await expect(
      renderBox
        .locator('[data-common-descriptions-value]')
        .filter({ hasText: 'zhangsan@example.com' }),
    ).toHaveCount(1);

    // 分组那张卡里两个 Description + 一条 Divider，全靠子组件写法
    // 标题必须点 `[data-common-descriptions-title]`：卡面提示语里也写了「基础信息」，
    // 用纯文本选择器会同时命中说明段
    const grouped = cardByTitle(page, '响应式列数与分组');
    await expect(
      grouped
        .locator('[data-common-descriptions-title]')
        .filter({ hasText: '基础信息' }),
    ).toBeVisible();
    await expect(
      grouped
        .locator('[data-common-descriptions-title]')
        .filter({ hasText: '金额信息' }),
    ).toBeVisible();
    // 两份 schema 各 7 项：基础信息 7 + 金额信息 7
    await expect(
      grouped.locator('[data-common-descriptions-label]'),
    ).toHaveCount(14);
    // render 里的 0 元运费换成「包邮」标签，实付金额走 contentStyle
    await expect(
      grouped.locator('[data-common-tag]').filter({ hasText: '包邮' }),
    ).toHaveCount(1);
    await expect(grouped.getByText('¥ 18116.91')).toBeVisible();
    expect(await grouped.locator('[role="separator"]').count()).toBe(1);

    expect(
      errors.warnings.filter((text) =>
        text.includes('Failed to resolve component'),
      ),
    ).toEqual([]);
    expect(descriptionErrors(errors.errors)).toEqual([]);
    errors.stop();
  });

  test('show: false 真的少两行，脱敏开关改的是值不是行数', async ({ page }) => {
    const errors = await open(page, DESCRIPTION);
    const box = cardByTitle(page, '动态切换');
    const labels = box.locator('[data-common-descriptions-label]');

    await expect(labels).toHaveCount(7);
    await expect(box.getByText('138****8888')).toBeVisible();
    await expect(box.getByText('1101**********001X')).toBeVisible();

    const sensitive = box.locator('[role="switch"]').first();
    await sensitive.click();
    await expect(labels).toHaveCount(5);
    // 只在标签格里查：卡面提示语原文就写着「身份证、发票抬头」，
    // 拿整卡文本做 toHaveCount(0) 会被提示语顶掉
    await expect(
      box
        .locator('[data-common-descriptions-label]')
        .filter({ hasText: '身份证号' }),
    ).toHaveCount(0);
    await expect(
      box
        .locator('[data-common-descriptions-label]')
        .filter({ hasText: '发票抬头' }),
    ).toHaveCount(0);
    await sensitive.click();
    await expect(labels).toHaveCount(7);

    // 脱敏关掉：还是 7 行，变的是格子里的值
    await box.locator('[role="switch"]').nth(1).click();
    await expect(labels).toHaveCount(7);
    await expect(box.getByText('13812348888')).toBeVisible();
    await expect(box.getByText('11010119960515001X')).toBeVisible();

    // 只读实例上只有 getData()
    await box.getByRole('button', { name: /调用 getData\(\)/ }).click();
    await expect(
      page
        .locator('li[data-sonner-toast]')
        .filter({ hasText: 'getData() 读到 7 个字段' }),
    ).toBeVisible();

    // 「模拟刷新详情」是 setTimeout 改 data，组件跟着响应
    await box.getByRole('button', { name: /模拟刷新详情/ }).click();
    await expect(box.getByText('2026-10-12 09:05:32')).toBeVisible({
      timeout: 15_000,
    });
    await expect(box.getByText(/工作日 18:00 前送达/)).toBeVisible();

    expect(descriptionErrors(errors.errors)).toEqual([]);
    expect(errors.badResponses).toEqual([]);
    errors.stop();
  });

  test('column 与 bordered 在页面这层算完再传进去，改的就渲染出来', async ({
    page,
  }) => {
    const errors = await open(page, DESCRIPTION);
    const box = cardByTitle(page, '响应式列数与分组');
    // 两个 Description 各自的表头就是 `[data-common-descriptions-title]`
    await expect(box.locator('[data-common-descriptions-title]')).toHaveCount(
      2,
    );

    /**
     * 数「排了几行」。
     *
     * `Descriptions` 用 CSS grid 排版，`column` 只体现在 `grid-template-columns` 上，
     * DOM 里没有行节点，所以按格子的 top 去重 —— 数的是页面上真的看到的行数。
     */
    function distinctRows(items: Locator) {
      return items.evaluateAll(
        (els) =>
          new Set(els.map((el) => Math.round(el.getBoundingClientRect().top)))
            .size,
      );
    }

    await expect(box.getByText(/当前 column = \d/)).toBeVisible();
    await box.getByText('1 列', { exact: true }).click();
    await expect(box.getByText('当前 column = 1')).toBeVisible();

    const firstItems = box
      .locator('[data-common-descriptions]')
      .first()
      .locator('[data-common-descriptions-item]');
    const firstCount = await firstItems.count();
    expect(firstCount).toBeGreaterThanOrEqual(6);
    // 每行一项 → 行数与项数相等
    await expect
      .poll(() => distinctRows(firstItems), { message: '1 列要每项独占一行' })
      .toBe(firstCount);
    expect(
      await distinctRows(box.locator('[data-common-descriptions-item]')),
    ).toBeGreaterThanOrEqual(13);

    await box.getByText('3 列', { exact: true }).click();
    await expect(box.getByText('当前 column = 3')).toBeVisible();
    // 收到 3 列：同样的项数要排得下，行数必须比项数少
    await expect
      .poll(() => distinctRows(firstItems), { message: '3 列要一行排多项' })
      .toBeLessThan(firstCount);

    // bordered 关掉后组件不再挂 `data-bordered="true"`
    await box.locator('[role="switch"]').first().click();
    await expect(
      box.locator('[data-common-descriptions][data-bordered="true"]'),
    ).toHaveCount(0);
    await box.locator('[role="switch"]').first().click();
    await expect(
      box.locator('[data-common-descriptions][data-bordered="true"]'),
    ).toHaveCount(2);

    expect(
      errors.warnings.filter((text) =>
        text.includes('Failed to resolve component'),
      ),
    ).toEqual([]);
    expect(descriptionErrors(errors.errors)).toEqual([]);
    errors.stop();
  });
});

test.describe('自定义指令页', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('v-demo-permission 四种判定，勾选权限后已渲染的按钮自己翻正', async ({
    page,
  }) => {
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
    const fullScreen = page.locator(
      'body > .loading-directive-wrapper .loading-wrapper',
    );
    await expect(fullScreen).toBeVisible();
    await expect(page.locator('body > .loading-directive-wrapper')).toHaveCount(
      0,
      {
        timeout: 8000,
      },
    );

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

  test('v-escape 把脚本当纯文本，:url 把伪协议换成 #unsafe-url', async ({
    page,
  }) => {
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
    const errors = await open(page, DRAG_LAYOUT);
    for (const path of [OVERVIEW, DRAG_SORT, MODAL_DRAWER, DRAG_LAYOUT]) {
      await go(page, path);
      await expectActivePath(page, path);
    }
    // 落点仍是最后打开的那一页：标签栏与路由两头对得上
    await expect(tab(page, DRAG_LAYOUT)).toHaveAttribute('data-active', 'true');
    await expectActivePath(page, DRAG_LAYOUT);
    expect(errors.errors).toEqual([]);
    errors.stop();
  });
});
