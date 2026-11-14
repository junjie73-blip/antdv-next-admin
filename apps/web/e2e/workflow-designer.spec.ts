import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * 审批流设计器的浏览器验证。
 *
 * 包内 135 条单测把语义都证明了，但纯函数与挂载测试看不到这三件事，只有真浏览器能：
 * 1. **vue-flow 的 CSS 真的进来了** —— 样式是组件里 side-effect import 的，构建/外链
 *    配置一漏，画布会塌成「节点堆在左上角的一坨 div」，而单测照样全绿；
 * 2. **坐标是真的** —— 演示定义没画过坐标（后端存出来的定义本来就可以只有拓扑），
 *    映射层的分层兜底必须能在屏幕上量出「铺开了、互不重叠」。叠成一坨时任何一次点击
 *    命中的都是最上面那张卡片，那么第 3 条里的交互全是假的；
 * 3. **点得中、连得上** —— 选中/改名/删除/拖一条新连线整条链都依赖真实命中测试，
 *    `Handle` 的层级、画布缩放与 `pointer-events` 任一出错，交互就整条哑掉。
 *
 * 数据侧仍走内存 store：这一页不发业务请求，所以 `badResponses` 为空本身也是结论。
 */

const NODE_CARD = '[data-testid="designer-node"]';
const EDGE = '.vue-flow__edge';

/** 演示流程 leave-demo：8 个节点（含自定义 erpSync）+ 8 条边 */
const EDGE_COUNT = 8;

function designer(page: Page): Locator {
  return page.locator('[data-slot="workflow-definition-designer"]');
}

function nodes(page: Page): Locator {
  return designer(page).locator(NODE_CARD);
}

async function openDesignerPage(page: Page) {
  await signIn(page);
  await go(page, '/enterprise/workflow');
  await expect(designer(page)).toBeVisible();
  /**
   * 等路由切换那块全屏遮罩退掉。
   *
   * 它的 leave 动画有 150ms，期间 `opacity-0` 但 `absolute inset-0 z-50` 还挂在命中层上，
   * 紧随的第一次点击有概率打在遮罩上（表现是"点了节点没选中"，而组件一切正常）。
   */
  await expect(page.getByText('页面加载中')).toBeHidden();
  /**
   * 把画布滚进视口。
   *
   * 这一页上面还有一张「发起流程」卡片，画布落在首屏之下。`locator.click()` 会自己滚，
   * 但 `page.mouse.*` 吃的是**视口坐标**：量到的 `boundingBox().y` 超出视口高度时，
   * 那一下点在了页面之外（`document.elementFromPoint` 返回 null），
   * 表现是"拖了半天没连线"，而组件本身毫无问题 —— 所以凡是后面要用裸坐标的地方，先滚进来。
   */
  await designer(page)
    .locator('[data-slot="designer-canvas"]')
    .scrollIntoViewIfNeeded();
}

/** 节点卡片在屏幕上的矩形：布局类断言都从这里取 */
async function nodeBoxes(page: Page) {
  // 必须 `Promise.all`：`await [p1, p2]` await 的是数组本身，拿回来的是未决议的 Promise，
  // 于是 `box.x` 全是 undefined —— 几何断言会静默退化成"永远同一个值"，看着绿其实什么都没量
  return Promise.all(
    (await nodes(page).all()).map(async (el) => await el.boundingBox()),
  );
}

/**
 * 取一条边**可见描边**中点的屏幕坐标。
 *
 * 不能用 `boundingBox()` 的矩形中心：贝塞尔曲线的包围盒中心多半不在曲线上，点下去落在
 * 画布空白处，于是"选中连线 → 删除连线"整条链永远走不通（而且红得毫无信息量）。
 * `getPointAtLength` 拿的是线上真有一点，`getScreenCTM` 把它换算到屏幕，
 * 落的正是用户会用鼠标去点的那个位置。
 */
async function edgePoint(page: Page, index: number) {
  return designer(page)
    .locator(EDGE)
    .nth(index)
    .evaluate((el) => {
      const path = (el.querySelector('path.vue-flow__edge-path') ??
        el.querySelector('path')) as null | SVGPathElement;
      if (!path) throw new Error('这条边没有描边路径');
      const at = path.getPointAtLength(path.getTotalLength() / 2);
      const ctm = path.getScreenCTM();
      if (!ctm) throw new Error('拿不到 SVG 到屏幕的变换');
      return {
        x: ctm.a * at.x + ctm.c * at.y + ctm.e,
        y: ctm.b * at.x + ctm.d * at.y + ctm.f,
      };
    });
}

function overlapping(
  boxes: Array<null | { height: number; width: number; x: number; y: number }>,
): boolean {
  const real = boxes.filter(
    (box): box is { height: number; width: number; x: number; y: number } =>
      !!box,
  );
  return real.some((a, i) =>
    real
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

/**
 * 从一个端点按住拖到另一个端点 —— 连线全靠这一下，所以它必须走真实指针：
 * `Handle` 的层级、`nodrag` 是否生效、画布缩放后的命中区，任一有问题这里就断。
 */
async function dragBetween(
  page: Page,
  from: Locator,
  to: Locator,
): Promise<void> {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  expect(fromBox, '源端点没量到坐标').toBeTruthy();
  expect(toBox, '目标端点没量到坐标').toBeTruthy();

  await page.mouse.move(
    fromBox!.x + fromBox!.width / 2,
    fromBox!.y + fromBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    toBox!.x + toBox!.width / 2,
    toBox!.y + toBox!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

function distinctPositions(
  boxes: Array<null | { x: number; y: number }>,
): number {
  return new Set(
    boxes
      .filter((box): box is { x: number; y: number } => !!box)
      .map((box) => `${Math.round(box.x)},${Math.round(box.y)}`),
  ).size;
}

test.describe('审批流设计器', () => {
  test('画布按定义渲染节点与连线，vue-flow 样式生效且没有本站错误', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    // 演示流程 leave-demo：8 个节点（含自定义 erpSync）+ 8 条边
    // （s→leader→gw，gw 分两条 toHr/toCc，hr→cc→archive→sync→e）
    await expect(nodes(page)).toHaveCount(8);
    await expect(designer(page).locator(EDGE)).toHaveCount(EDGE_COUNT);

    // 样式没进来时 .vue-flow__node 不带 transform，节点也不会各自成层
    const transforms = await designer(page)
      .locator('.vue-flow__node')
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).style.transform),
      );
    expect(transforms.every((value) => value.includes('translate'))).toBe(true);

    // 可连线的端点只在可编辑时挂出来：每个节点一进一出
    await expect(designer(page).locator('.vue-flow__handle')).toHaveCount(16);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('调色板加节点：卡片追加、名称按类型给默认值、孤立节点只算提醒不算错误', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    await designer(page)
      .getByTestId('designer-palette-item')
      .filter({ hasText: '抄送' })
      .click();
    await expect(nodes(page)).toHaveCount(9);

    // 新节点排在定义末尾，DOM 顺序一致，所以按序号取比按文案取确定
    const added = nodes(page).nth(8);
    await expect(added).toContainText('抄送');

    // 未连线的节点是 warning：徽章继续说"定义可用"，否则用户会以为流程坏了
    await expect(designer(page).getByTestId('designer-issue-badge')).toHaveText(
      '定义可用',
    );
    expect(errors.errors).toEqual([]);
  });

  test('点节点选中的是它自己：属性面板回填，改名同步回画布卡片', async ({
    page,
  }) => {
    await openDesignerPage(page);

    await nodes(page).filter({ hasText: '主管审批' }).first().click();

    const inspector = page.locator('[data-slot="workflow-node-inspector"]');
    await expect(inspector).toBeVisible();
    await expect(inspector.locator('#wf-node-label')).toHaveValue(/主管审批/);

    await inspector.locator('#wf-node-label').fill('主管复核');
    await expect(nodes(page).filter({ hasText: '主管复核' })).toHaveCount(1);

    // 选中态（ring）只落在这一个节点上
    const ringCount = await nodes(page).evaluateAll(
      (els) =>
        els.filter((el) => (el.className || '').includes('ring-2')).length,
    );
    expect(ringCount).toBe(1);

    // 面板上的 id 与卡片顺序对得上，宿主保存时才知道改的是谁
    await expect(inspector).toContainText('leader');
  });

  test('删除按钮跟着选中态走：删掉新加的节点后回到 8 个', async ({ page }) => {
    await openDesignerPage(page);

    await expect(
      designer(page).getByTestId('designer-remove-node'),
    ).toBeDisabled();

    await designer(page)
      .getByTestId('designer-palette-item')
      .filter({ hasText: '定时等待' })
      .click();
    await expect(nodes(page)).toHaveCount(9);
    await nodes(page).nth(8).click();
    await expect(
      designer(page).getByTestId('designer-remove-node'),
    ).toBeEnabled();

    await designer(page).getByTestId('designer-remove-node').click();
    await expect(nodes(page)).toHaveCount(8);
    await expect(
      designer(page).getByTestId('designer-remove-node'),
    ).toBeDisabled();
  });

  test('定义没画坐标也铺得开：首屏互不重叠，点自动布局一格不动但坐标进了模型', async ({
    page,
  }) => {
    await openDesignerPage(page);

    // 演示定义只有拓扑、没有坐标。叠在原点时这里是 1 个位置 + overlapping=true，
    // 于是"点节点选中它自己"那类用例命中的永远是最上面那张卡片 —— 全绿的假象
    const before = await nodeBoxes(page);
    expect(before).toHaveLength(8);
    expect(distinctPositions(before)).toBe(8);
    expect(overlapping(before)).toBe(false);

    await designer(page).getByTestId('designer-auto-layout').click();

    // 视图兜底用的就是 autoLayout，它也是确定的：点完按钮坐标不该动
    const rounded = (boxes: Awaited<ReturnType<typeof nodeBoxes>>) =>
      boxes.map((box) => box && [Math.round(box.x), Math.round(box.y)]);
    expect(rounded(await nodeBoxes(page))).toEqual(rounded(before));
    expect(overlapping(await nodeBoxes(page))).toBe(false);

    // 铺开之后仍点得中：点第一个节点，属性面板就出现
    await nodes(page).first().click();
    await expect(
      page.locator('[data-slot="workflow-node-inspector"]'),
    ).toBeVisible();
  });

  test('从一个节点拖一条新连线到另一个节点：边数 +1，语义由 connect() 判', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    // 顺序按定义的节点数组：0 发起 / 1 主管审批 / 2 分流网关 / 3 人事会签
    // 首屏就已经铺开，不需要先点自动布局 —— 端点坐标重合的那次缺陷正是没铺开
    await dragBetween(
      page,
      nodes(page).nth(1).locator('.vue-flow__handle-right'),
      nodes(page).nth(3).locator('.vue-flow__handle-left'),
    );

    // 审批 → 审批 是合法连线（既非自环也非重复）
    await expect(designer(page).locator(EDGE)).toHaveCount(EDGE_COUNT + 1);
    expect(errors.errors).toEqual([]);
  });

  test('连进发起节点会被拒：connect() 的人话理由一路冒到 toast', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    // 1 是主管审批（可出），0 是发起（入口，语义上不能有入边）
    // vue-flow 只管"从锚点拖到另一个节点的锚点"，能不能落边完全由 connect() 判
    await dragBetween(
      page,
      nodes(page).nth(1).locator('.vue-flow__handle-right'),
      nodes(page).nth(0).locator('.vue-flow__handle-left'),
    );

    await expect(designer(page).locator(EDGE)).toHaveCount(EDGE_COUNT);
    await expect(page.getByText('不能作为连线终点').first()).toBeVisible();
    expect(errors.errors).toEqual([]);
  });

  /**
   * 自环这一条要说清"是谁拦的"：vue-flow 在 pointerup 之前就把"起点终点是同一个节点"
   * 的拖拽丢掉了，`connect` 事件根本不触发，所以我们那句"不能把节点连到它自己"在这里
   * 冒不出来（这条在包内单测里由 `connect()` 直接验）。画布侧要保证的是同一件事的另一半：
   * **既不静默多一条脏边，也不因此报错**。
   */
  test('拖回自己不加分支：画布不静默产生脏数据，也不炸', async ({ page }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    const start = nodes(page).nth(0);
    await dragBetween(
      page,
      start.locator('.vue-flow__handle-right'),
      start.locator('.vue-flow__handle-left'),
    );

    await expect(designer(page).locator(EDGE)).toHaveCount(EDGE_COUNT);
    expect(errors.errors).toEqual([]);
  });

  test('点边可选中并删除：只少一条线，节点一个都不掉', async ({ page }) => {
    const errors = watchErrors(page);
    await openDesignerPage(page);

    await expect(
      designer(page).getByTestId('designer-remove-edge'),
    ).toBeDisabled();

    // 0 是 s→leader：两点之间只有这一段线，中点上没有别的元素挡着
    const at = await edgePoint(page, 0);
    await page.mouse.click(at.x, at.y);
    await expect(
      designer(page).getByTestId('designer-remove-edge'),
    ).toBeEnabled({
      timeout: 5000,
    });
    await designer(page).getByTestId('designer-remove-edge').click();

    await expect(designer(page).locator(EDGE)).toHaveCount(EDGE_COUNT - 1);
    await expect(nodes(page)).toHaveCount(8);
    expect(errors.errors).toEqual([]);
  });
});
