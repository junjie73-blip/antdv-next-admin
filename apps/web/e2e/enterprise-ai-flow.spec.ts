import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, painted, signIn, watchErrors } from './utils/app';

/**
 * AI 工作流编排示例页的浏览器验证。
 *
 * 包内 187 条单测把 `core/runner` 的调度语义（波次、分支、挂起、续跑、取消、工具循环）
 * 证得很足，但它们跑在 jsdom 里、画布那层只测到「映射出来的对象对不对」。
 * 只有真浏览器能给出这三条结论，用例照着它们写：
 *
 * 1. **运行态涂色是 CSS 层的事**。`AI_NODE_STATUS_RING` / `toCanvasEdges` 把状态映射成
 *    `ring-2 ring-warning`、`stroke-primary` 这类工具类，类名写错、或 Tailwind 的 `@source`
 *    没登记本包，表现都是"节点外环永远是同一圈灰、每条边都是同一个颜色"，单测里对象断言照样全绿。
 *    这里量的是浏览器真的算出来的 box-shadow 与 stroke。
 * 2. **画布点选是 vue-flow 的真实手势**。`@node-click` 只在指针事件落在节点卡片上时才发，
 *    fitView 之后的缩放坐标 jsdom 根本没有。
 * 3. **改一个节点的字段，下一次运行真的吃到新值**。示例页刻意做原地数组替换（不重建 `flow` 对象），
 *    因为 `useAiFlow` 在 setup 时就把那份引用交给了运行器 —— 这条分工错了，表现是
 *    「面板改完、跑出来还是旧模板」，只有真跑一遍能发现。
 *
 * Provider 是 `createScriptedProvider` 的离线回放，全程零请求，所以 `badResponses` 为空
 * 与「token 计数正好等于脚本里写的那份 usage」互为佐证。
 */

const CANVAS = '[data-slot="ai-flow-canvas"]';
const CANVAS_NODE = '[data-slot="ai-flow-canvas-node"]';
const PANEL = '[data-slot="ai-run-panel"]';
const AWAITING = '[data-slot="ai-run-panel-awaiting"]';
const OUTPUT = '[data-slot="ai-run-panel-output"]';
const INSPECTOR = '[data-slot="ai-node-inspector"]';

function canvas(page: Page): Locator {
  return page.locator(CANVAS);
}

function panel(page: Page): Locator {
  return page.locator(PANEL);
}

/**
 * 面板那颗总状态徽标。
 * 必须限定在面板里：宿主卡片上还有一颗 `<Badge>{{ ai.status }}</Badge>`，它印的是**原始枚举值**
 * （`awaiting` / `succeeded`），演示"宿主想显示英文就显示英文"。用 `page.getByText('未运行')`
 * 会一次撞上两颗，Playwright 的 strict mode 直接报错。
 */
function panelStatus(page: Page): Locator {
  return panel(page).locator('[data-slot="ai-run-panel-status"]');
}

/** 流式 token 落在自己那一行里：两个节点同时在流时不该混成一坨 */
function streamOf(page: Page, label: string): Locator {
  return nodeRow(page, label).locator('[data-slot="ai-run-panel-stream"]');
}

/**
 * 某条边的实际描边颜色。
 *
 * 按 `data-id` 选，不按 nth：vue-flow 渲染边的顺序不等于 `flow.edges` 的声明顺序
 * （它内部按 source/target 的连线建立次序重排过一次），拿 nth 当索引等于在断言一个没人保证的顺序。
 * `data-id` 是 vue-flow 自己写在 `<g class="vue-flow__edge">` 上的，就是图里那条边的 id。
 *
 * 读计算出来的 stroke 而不是类名：`edge.class` 挂在 `<g>` 上，而 vue-flow 自带的
 * `style.css` 有一条 `.vue-flow__edge-path { stroke: #b1b1b7 }` 直接命中 `<path>` ——
 * 只写类名时这里读到的永远是那个默认灰，单测里断言类名却全绿。
 */
async function edgeStroke(page: Page, edgeId: string): Promise<string> {
  return canvas(page)
    .locator(`.vue-flow__edge[data-id="${edgeId}"] path.vue-flow__edge-path`)
    .first()
    .evaluate((el) => getComputedStyle(el as Element).stroke);
}

/** 画布上按卡片文案找节点：示例页的 label 就是业务同学会读的那句话 */
function canvasNode(page: Page, label: string): Locator {
  return canvas(page).locator(CANVAS_NODE).filter({ hasText: label });
}

/** 运行面板里那一行节点状态（按钮上的徽标文本就是 runner 给的 status） */
function nodeRow(page: Page, label: string): Locator {
  return panel(page)
    .locator('[data-slot="ai-run-panel-nodes"] li')
    .filter({ hasText: label });
}

/** 面板上那行用量摊成数字：入账是脚本写的，出账里还混着 Provider 按长度估的那部分 */
async function usageNumbers(
  page: Page,
): Promise<{ completion: number; prompt: number; total: number }> {
  const text = await panel(page)
    .locator('[data-slot="ai-run-panel-usage"]')
    .innerText();
  return {
    completion: Number(/出参 token (\d+)/u.exec(text)?.[1] ?? -1),
    prompt: Number(/入参 token (\d+)/u.exec(text)?.[1] ?? -1),
    total: Number(/合计 (\d+)/u.exec(text)?.[1] ?? -1),
  };
}

async function openAiFlowPage(page: Page) {
  await signIn(page);
  await go(page, '/enterprise/ai-flow');
  await expect(canvas(page)).toBeVisible();
  // 路由级 loading 罩层会吃掉导航后的第一次点击
  await expect(page.getByText('页面加载中')).toBeHidden();
}

/** 填工单 -> 跑一次（点面板那颗，和宿主卡片那颗「跑一次」是同一条 `ai.run`） */
async function runTicket(page: Page, ticket: string) {
  await page.getByLabel(/工单原话/).fill(ticket);
  await panel(page).locator('[data-action="run"]').click();
}

/** 挂起区块里提交人工输入并续跑 */
async function resumeWith(page: Page, text: string) {
  await page.locator('[data-field="resume-input"]').fill(text);
  await page.locator('[data-action="resume"]').click();
}

test.describe('AI 工作流编排', () => {
  test('画布按定义渲染七个节点七条边，定义期体检干净', async ({ page }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    await expect(canvas(page).locator('.vue-flow__node')).toHaveCount(7);
    await expect(canvas(page).locator('.vue-flow__edge')).toHaveCount(7);
    // 卡片文案来自 `describeNode`：它读的是节点上真正配了什么，不是又写一套"读图"逻辑
    await expect(canvasNode(page, '分诊（JSON 输出）')).toBeVisible();
    await expect(canvasNode(page, '按紧急度分流')).toContainText('1 个分支');
    await expect(canvasNode(page, '人工确认')).toContainText(
      '确认无误后点「发送」',
    );

    // 未运行时的状态徽标与空态文案：runner 的 `status` 缺省是 running，界面不许拿它糊弄眼睛
    await expect(panel(page).getByText('还没有节点执行过。')).toBeVisible();
    await expect(panelStatus(page)).toHaveText('未运行');
    // `validateAiFlow` 干净时才没有那条待确认项 Alert；一旦图里少个字段，这里就是它现身的时候
    await expect(page.getByText(/编排图有 \d+ 条待确认项/)).toHaveCount(0);

    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('非紧急工单走默认分支：未命中的那条整条 skipped，收口吃人工输入的兜底', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    await runTicket(page, '物流一直不动，帮我看看这单到哪了');

    // 条件分支按 `classify.urgent` 判假 -> 只走默认边，工具与起草整条没被调度
    await expect(nodeRow(page, '分诊（JSON 输出）')).toContainText('succeeded');
    await expect(nodeRow(page, '按紧急度分流')).toContainText('succeeded');
    await expect(nodeRow(page, '查订单进度（工具）')).toContainText('skipped');
    await expect(nodeRow(page, '起草回复')).toContainText('skipped');
    // 「还没轮到」的收口节点不许一起被标成 skipped：它正是续跑之后要跑的那一步
    await expect(nodeRow(page, '发出')).toContainText('pending');

    // human 节点挂起：面板给出宿主写的续跑文案，页面没有报错区
    await expect(panel(page).locator(AWAITING)).toBeVisible();
    await expect(panel(page).locator(AWAITING)).toContainText(
      '确认无误后点「发送」',
    );
    await expect(
      panel(page).locator('[data-slot="ai-run-panel-error"]'),
    ).toHaveCount(0);
    // 挂起是收口，不是失败：状态徽标要说清「等人」
    await expect(panelStatus(page)).toHaveText('等待人工确认');

    await resumeWith(page, '同意发送');
    // 这条分支没有 `draft`，模板里那句 `{{ draft ?? confirm_human }}` 落到人工输入上：
    // 少这个兜底就是「节点失败：模板缺少变量」，而不是发出去一句话
    await expect(panel(page).locator(OUTPUT)).toContainText(
      '【logistics】同意发送',
    );
    await expect(panelStatus(page)).toHaveText('成功');
    // 这条分支只调过一次模型，用量就是脚本里写死的那份：物流分诊 = 入 80 / 出 12
    expect(await usageNumbers(page)).toEqual({
      completion: 12,
      prompt: 80,
      total: 92,
    });

    expect(errors.errors).toEqual([]);
  });

  test('紧急工单走另一条分支：工具真跑、起草逐字流到面板，token 计数就是脚本写的那份', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    await runTicket(page, '这笔退款怎么还没到账');

    await expect(nodeRow(page, '查订单进度（工具）')).toContainText(
      'succeeded',
    );
    await expect(nodeRow(page, '起草回复')).toContainText('succeeded');
    // 只有开了 `stream` 的 llm 节点才有这一段：工具节点没有 token 流，产物走 node.output
    await expect(streamOf(page, '起草回复')).toContainText(
      '您的订单仓库已接单',
    );
    await expect(
      nodeRow(page, '查订单进度（工具）').locator(
        '[data-slot="ai-run-panel-stream"]',
      ),
    ).toHaveCount(0);
    // 产物键写在画布卡片上：下游模板吃的是它，不是节点标题
    await expect(canvasNode(page, '查订单进度（工具）')).toContainText('order');
    // 分诊那条脚本写的是入 88，起草那条没写 usage（Provider 按长度估），所以这里断言"至少吃到脚本那份 + 合计自洽"，
    // 而不是把估算值钉成一个常量 —— 钉死了等于把测试绑在估算公式上
    const usage = await usageNumbers(page);
    expect(usage.prompt, '脚本写死的 88 没进账').toBeGreaterThanOrEqual(88);
    expect(usage.total).toBe(usage.prompt + usage.completion);

    await resumeWith(page, '同意');
    // 收口模板拼的是 `{{ classify.category }}` + 起草节点产物：两个上游都到位才有这句话
    await expect(panel(page).locator(OUTPUT)).toContainText(
      '【refund】您的订单仓库已接单',
    );

    expect(errors.errors).toEqual([]);
  });

  test('运行态涂色落在真实 CSS 上：成功环、等待环、没走到的分支是三种画法', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    await runTicket(page, '物流一直不动，帮我看看这单到哪了');
    await expect(nodeRow(page, '分诊（JSON 输出）')).toContainText('succeeded');

    const shadowOf = (label: string) =>
      canvasNode(page, label).evaluate(
        (el) => getComputedStyle(el as Element).boxShadow,
      );
    /**
     * `skipped` / `pending` 都不画外环，两者只差在整张卡片的透明度 ——
     * 拿 boxShadow 比这两个状态永远相等，只有 `opacity` 判得出来。
     */
    const opacityOf = (label: string) =>
      canvasNode(page, label).evaluate(
        (el) => getComputedStyle(el as Element).opacity,
      );
    const succeeded = await shadowOf('分诊（JSON 输出）');
    const awaiting = await shadowOf('人工确认');
    const skipped = await shadowOf('查订单进度（工具）');
    const pending = await shadowOf('发出');

    // 类名到位（映射写错就没有 ring），且四种状态画出四种实际效果（工具类没生成就全都一样）
    await expect(canvasNode(page, '分诊（JSON 输出）')).toHaveClass(
      /ring-success/u,
    );
    await expect(canvasNode(page, '人工确认')).toHaveClass(/ring-warning/u);
    await expect(canvasNode(page, '查订单进度（工具）')).toHaveClass(
      /opacity-40/u,
    );
    await expect(canvasNode(page, '发出')).toHaveClass(/opacity-70/u);
    expect(succeeded, 'succeeded 与 awaiting 的外环是同一个颜色').not.toBe(
      awaiting,
    );
    // 对照组要挑真的没画环的节点：这条分支里「入口」也是 succeeded，拿它比就等于什么都没比
    expect(succeeded, 'ring 类没生成外环：涂色全靠 boxShadow').not.toBe(
      pending,
    );
    // skipped 与 pending 都不画外环，差别只在整张卡片的透明度上 —— boxShadow 比它们永远相等
    expect(skipped, '未命中分支不该被画出一圈环（它连跑都没跑）').toBe(pending);
    expect(
      await opacityOf('查订单进度（工具）'),
      'skipped 没被压暗：分支没走根本看不出来',
    ).toBe('0.4');
    expect(
      await opacityOf('发出'),
      'pending 与 skipped 压成一样的暗度：续跑要跑到谁看不出来',
    ).toBe('0.7');
    expect(await opacityOf('入口'), '跑成功的节点不该被压暗').toBe('1');

    // 边走廊同理：未命中的 `eUrgent` 不该跟着源节点一起亮主色，否则"走了哪条路"白画
    const [primary, border] = await Promise.all([
      painted(page, 'hsl(var(--primary))'),
      painted(page, 'hsl(var(--border))'),
    ]);
    expect(await edgeStroke(page, 'eNormal'), '命中的那条边没涂主色').toBe(
      primary,
    );
    expect(await edgeStroke(page, 'eUrgent'), '未命中的边也亮了主色').not.toBe(
      primary,
    );
    expect(await edgeStroke(page, 'eUrgent')).toBe(border);

    expect(errors.errors).toEqual([]);
  });

  test('画布点选 → 面板改收口模板 → 下一次运行吃到新模板', async ({ page }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    await canvasNode(page, '发出').click();
    await expect(page.locator(INSPECTOR)).toContainText('发出');
    await expect(page.locator('#ai-inspector-prompt')).toHaveValue(
      '【{{ classify.category }}】{{ draft ?? confirm_human }}',
    );

    await page
      .locator('#ai-inspector-prompt')
      .fill('【{{ classify.category }}】改过的收口模板');
    await runTicket(page, '物流一直不动，帮我看看这单到哪了');
    await resumeWith(page, '同意发送');

    // 运行器手里还是同一个 `flow` 对象：原地换掉数组里那一项才会被下一次 run 读到
    await expect(panel(page).locator(OUTPUT)).toContainText('改过的收口模板');

    expect(errors.errors).toEqual([]);
  });

  test('「清空注入的运行时」不影响已经装配好的 runner', async ({ page }) => {
    const errors = watchErrors(page);
    await openAiFlowPage(page);

    // `configureAiFlow()` 是声明，`createConfiguredAiRunner()` 是装配：页面 setup 时就已经把
    // Provider 与工具抓进 runner 手里，之后清空全局运行时只影响"下一次装配"
    await page.getByRole('button', { name: '清空注入的运行时' }).click();
    await expect(page.getByText('已清空注入的运行时').first()).toBeVisible();

    await runTicket(page, '这笔退款怎么还没到账');
    await expect(nodeRow(page, '分诊（JSON 输出）')).toContainText('succeeded');
    await expect(panel(page).locator(AWAITING)).toBeVisible();
    // 面板那颗「取消」此刻是禁用的：脚本 Provider 同步回放，`run()` 早就 resolve 了，
    // `useAiFlow.running` 跟着回落 —— "取消只对在跑的运行有效"由包内单测守着，这里只确认界面没点错
    await expect(panel(page).locator('[data-action="cancel"]')).toBeDisabled();

    expect(errors.errors).toEqual([]);
  });
});
