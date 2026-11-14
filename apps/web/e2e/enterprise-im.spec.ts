import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * IM 即时通讯的浏览器验证。
 *
 * `im-ui` 的包内单测（246 条）把 `core/*` 的时序证明得很足：乐观发送、ack 改名、未读数学、
 * typing 节流、撤回窗口、坏帧编解码都是纯逻辑，jsdom 里跑不出问题。下面这七条要拿的是
 * 只有真浏览器才能给的结论：
 *
 * 1. **虚拟列表真的在虚拟** —— 120 条 seed 超过 `MESSAGE_VIRTUALIZE_THRESHOLD`，
 *    DOM 里只该有窗口那十几行，`[data-total-size]` 撑起滚动条；jsdom 没有布局，
 *    "贴底"、"上翻不跳位"、"overscan"三件事在单测里全是估算值。
 * 2. **剧本时序落地成界面** —— 260ms 出"正在输入"、1200ms 出回复、1300ms 收起；
 *    这条链路里 transport、状态机、面板三层各管一段，任何一层接线错了单测都不会红。
 * 3. **宿主注入的三样东西真的被用上** —— `configureIm({ now })`（拨钟之后撤回当场超窗）、
 *   `createObjectUrl`（附件缩略图拿到 `blob:` 地址）、`limits`（正文上限压到 30 字后输入区拦住）。
 *
 * 全程离线：服务端是本页 `scriptedServer` 那段闭包函数，`badResponses` 为空本身就是结论。
 * 头像走 `https://sealed.example/...`（宿主注入的假 CDN），拉不到只进 `external` 桶，不判负。
 */

const PANEL = '[data-slot="im-panel"]';
const PANE = '[data-slot="im-message-pane"]';
const VIEWPORT = '[data-slot="scroll-area-viewport"]';
const COMPOSER = '[data-slot="im-composer"]';

/** 会话项按 id 取：列表顺序会随 `lastMessageAt` 变，下标不是稳定的观测点 */
function panel(page: Page): Locator {
  return page.locator(PANEL);
}

function pane(page: Page): Locator {
  return panel(page).locator(PANE);
}

function conversation(page: Page, id: string): Locator {
  return panel(page).locator(`[data-conversation-id="${id}"]`);
}

function pageButton(page: Page, name: string): Locator {
  return page.getByRole('button', { exact: true, name });
}

/** `@antdv/popup-ui` 的轻提示走 vue-sonner：失败原因要说给用户看，不该只留在 `outcome` 里 */
function toast(page: Page, text: string): Locator {
  return page
    .locator('li[data-sonner-toast]')
    .filter({ hasText: text })
    .first();
}

/**
 * 顶栏那枚「N 条（虚拟列表）」徽章：消息总数最直接的观测点。
 *
 * 只认 `[data-slot="badge"]`（`@antdv/shadcn-ui` 的 Badge 根节点）而不是"卡片里最后一个
 * span"：本页带"条"的字样多得很（说明文字、`N 条待发送`），按 span 取会把它们混进候选，
 * 而这一页只有那枚徽章同时满足"是 badge"与"文案含条"。
 */
function countBadge(page: Page): Locator {
  return page.locator('[data-slot="badge"]').filter({ hasText: '条' });
}

/**
 * 徽章里那个消息总数，作为"这一页历史有没有落地"的观测点。
 *
 * 只在滚轮循环里做只读查询，不参与断言：判"翻到了页"仍然由下面那条
 * `toContainText('150 条（虚拟列表）')` 负责，这里只决定"还要不要再滚下一格"。
 */
async function loadedCount(page: Page): Promise<number> {
  const text = await countBadge(page).textContent();
  return Number(text?.match(/\d+/)?.[0] ?? 0);
}

/**
 * 本条用例自己发出去的那条消息。
 *
 * 必须按 id 前缀取而不是 `[data-own="true"]`：seed 灌了 120 条历史，其中约 24 条就是"我方发言"
 * （`index % 5 === 2`），拿 `[data-own="true"]` 会命中一大把 —— 包内单测的夹具只有三五条消息，
 * 所以那种写法在 jsdom 里照样绿，真浏览器里点到的却是半年前那条的撤回按钮。
 * id 前缀同时覆盖改名前后：pending 是 `local-N`，ack 带回 `srv-` 前缀后原地改名。
 */
function freshOwn(page: Page): Locator {
  return pane(page).locator(
    '[data-message-id^="local-"], [data-message-id^="srv-local-"]',
  );
}

async function openImPage(page: Page) {
  await signIn(page);
  await go(page, '/enterprise/im');
  await expect(panel(page)).toBeVisible();
}

/**
 * 距底部多少像素。
 *
 * 只读不写：贴底与否、"上翻没被拽回去"都从这一个几何量判断，
 * 而不是去比 `scrollTop` 的绝对值 —— 行高由 `measureElement` 实测，各引擎差几像素很正常。
 */
function distanceToBottom(page: Page) {
  return async () =>
    pane(page)
      .locator(VIEWPORT)
      .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

test.describe('IM 即时通讯', () => {
  test('120 条 seed 走虚拟列表：窗口里只有那几行、总高撑起滚动条、首屏贴在最新一条', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    await expect(panel(page).locator('[data-connection-state]')).toHaveText(
      '已连接',
    );
    await expect(panel(page).locator('[data-panel-title]')).toHaveText('李珊');
    await expect(panel(page).locator('[data-conversation-id]')).toHaveCount(2);
    await expect(conversation(page, 'c-single')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(
      conversation(page, 'c-group').locator('[data-unread-count]'),
    ).toHaveText('3');

    // 虚拟化：DOM 里是窗口而不是 120 行，占位总高撑起滚动条
    const list = pane(page).locator('[data-message-list]');
    await expect(list).toHaveAttribute('data-message-list', 'virtual');
    const totalSize = Number(await list.getAttribute('data-total-size'));
    expect(totalSize, '虚拟模式没有占位总高就撑不出滚动条').toBeGreaterThan(
      5000,
    );
    const rendered = await pane(page).locator('[data-message-id]').count();
    expect(rendered, '整表渲染才会把 120 条全塞进 DOM').toBeLessThan(40);

    // 首屏贴底：看到最新消息，而不是半年前的一页
    await expect
      .poll(distanceToBottom(page), { timeout: 5000 })
      .toBeLessThanOrEqual(40);
    await expect(
      pane(page).getByText('第 400 条：这块的口径再对一次'),
    ).toBeVisible();
    await expect(countBadge(page)).toContainText('120 条（虚拟列表）');

    expect(errors.errors).toStrictEqual([]);
    expect(errors.badResponses).toStrictEqual([]);
    errors.stop();
  });

  test('发一条走完整链路：Enter 发出、ack 原地改名、260ms 起"正在输入"、1200ms 出回复后收起', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    const text = '口径确认一下：要明细还是汇总';
    await expect(panel(page).locator('[data-composer-count]')).toHaveText(
      '0/30',
    );

    const input = panel(page).locator('[data-composer-input]');
    await input.fill(text);
    await expect(panel(page).locator('[data-composer-count]')).toHaveText(
      `${text.length}/30`,
    );
    await input.press('Enter');

    // 乐观气泡 + 剧本服务端同步回 ack：本地 id 换成服务端 id，气泡不闪、也不多出第二条
    const mine = freshOwn(page);
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText(text);
    await expect(mine.locator('[data-message-status="sent"]')).toHaveText(
      '已发送',
    );

    // 剧本的三帧节奏：正在输入 → 回复 → 收起
    await expect(panel(page).locator('[data-typing]')).toHaveText(
      '李珊 正在输入…',
    );
    await expect(
      pane(page).getByText('收到，我看一下这份报表的口径。'),
    ).toBeVisible();
    await expect(panel(page).locator('[data-typing]')).toBeHidden();

    // 正在看的会话收到即已读：不许挂红点
    await expect(
      conversation(page, 'c-single').locator('[data-unread-count]'),
    ).toHaveCount(0);

    // 帧日志是这条链路的黑匣子：上行 send、下行 ack 带 serverId，两边都记到了
    const frames = page
      .locator('[data-slot="card"]')
      .filter({ hasText: '协议帧' });
    await expect(frames).toContainText('"type": "send"');
    await expect(frames).toContainText('"serverId": "srv-local-1"');

    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });

  test('发送失败给可展示的原因，重发落定后红条一起消失：陈旧诊断会把用户赶去点重连', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    await pageButton(page, '让下一条发送失败').click();
    const input = panel(page).locator('[data-composer-input]');
    await input.fill('这条会被剧本拒掉');
    await input.press('Enter');

    const failed = freshOwn(page).locator('[data-message-status="failed"]');
    await expect(failed).toHaveText('发送失败');
    await expect(panel(page).locator('[data-panel-error]')).toContainText(
      '本地剧本模拟的发送失败',
    );
    await expect(countBadge(page)).toContainText('121 条');

    await pane(page).locator('[data-action="retry"]').click();
    await expect(
      freshOwn(page).locator('[data-message-status="sent"]'),
    ).toHaveText('已发送');
    // 重发成功回来的那条 ack 就是"线路好了"的证据，红条必须跟着走
    await expect(panel(page).locator('[data-panel-error]')).toBeHidden();
    // 失败的那条被同一条消息落定取代，而不是留下一条失败 + 一条成功
    await expect(freshOwn(page)).toHaveCount(1);

    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });

  test('撤回：窗口内改成系统消息，拨过时钟之后给"已超过撤回时限"并且不动原消息', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    const input = panel(page).locator('[data-composer-input]');
    await input.fill('发出去又收回来');
    await input.press('Enter');
    const first = freshOwn(page);
    await expect(first).toContainText('发出去又收回来');

    await first.locator('[data-action="recall"]').click();
    await expect(pane(page).locator('[data-message-kind="system"]')).toHaveText(
      '该消息已撤回',
    );
    await expect(pane(page).getByText('发出去又收回来')).toHaveCount(0);

    // 注入的 `now()` 同时管时间戳与撤回窗口，所以"超窗"是点一下按钮就能看到的结果，不用真等两分钟
    await input.fill('这条来不及撤');
    await input.press('Enter');
    await pageButton(page, '把时钟拨过撤回窗口').click();
    await pageButton(page, '撤回最近一条').click();
    await expect(toast(page, '已超过撤回时限（2 分钟）')).toBeVisible();
    await expect(pane(page).getByText('这条来不及撤')).toBeVisible();
    // 超窗只报原因，不许悄悄把消息改成撤回态
    await expect(
      pane(page).locator('[data-message-kind="system"]'),
    ).toHaveCount(1);

    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });

  test('未读只算"没在看的那通会话"，切换即清零；在线圆点挂到对方身上而不是我自己', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    await pageButton(page, '让同事在群里发言').click();
    await expect(
      conversation(page, 'c-group').locator('[data-unread-count]'),
    ).toHaveText('4');
    // 群里的最后一条时间就是刚才，列表按它倒序 —— 会话项必须按 id 定位，下标会漂
    await expect(
      panel(page).locator('[data-conversation-id]').first(),
    ).toHaveAttribute('data-conversation-id', 'c-group');

    await pageButton(page, '切换对方在线状态').click();
    // 成员表是 `[我, 对方]`（与服务端会话表同形）：圆点必须挂到对方，否则永远不亮
    await expect(
      conversation(page, 'c-single').locator('[data-presence="online"]'),
    ).toBeVisible();

    await conversation(page, 'c-group').click();
    await expect(panel(page).locator('[data-panel-title]')).toHaveText(
      '报表项目群',
    );
    // 切进来看即已读：红点归零，这条与"正在看的会话不来红点"是同一个口径的两头
    await expect(
      conversation(page, 'c-group').locator('[data-unread-count]'),
    ).toHaveCount(0);
    await expect(pane(page).locator('[data-message-id^="grp-"]')).toHaveCount(
      1,
    );

    // 正在看的会话：来消息只上屏，不挂红点
    await pageButton(page, '让同事在群里发言').click();
    await expect(pane(page).locator('[data-message-id^="grp-"]')).toHaveCount(
      2,
    );
    await expect(
      conversation(page, 'c-group').locator('[data-unread-count]'),
    ).toHaveCount(0);
    // 群没有历史：剧本只对单聊回 `history`，翻页在这里是空页而不是报错
    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });

  test('正文上限被宿主压到 30 字：计数变红、原因就地写出、Enter 也发不出去', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    const input = panel(page).locator('[data-composer-input]');
    await input.fill('超'.repeat(32));
    await expect(panel(page).locator('[data-composer-count]')).toHaveText(
      '32/30',
    );
    // 按钮 disabled 之后浏览器不给 click，所以"点了才说原因"必须有一条按当前状态的兜底文案
    await expect(panel(page).locator('[data-composer-block]')).toHaveText(
      '超过 30 字',
    );
    await expect(panel(page).locator('[data-action="send"]')).toBeDisabled();

    const before = await pane(page).locator('[data-message-id]').count();
    await input.press('Enter');
    await expect(countBadge(page)).toContainText('120 条');
    expect(await pane(page).locator('[data-message-id]').count()).toBe(before);

    await input.fill('这条合法');
    await expect(panel(page).locator('[data-composer-count]')).toHaveText(
      '4/30',
    );
    await expect(panel(page).locator('[data-action="send"]')).toBeEnabled();
    await input.press('Enter');
    await expect(countBadge(page)).toContainText('121 条');
    // 发出即清草稿：切走再切回来不该看见已经发出去的字
    await expect(input).toHaveValue('');

    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });

  test('滚到顶翻一页历史：整页 30 条、前插不跳位，而且没动会话排序', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openImPage(page);

    await expect
      .poll(distanceToBottom(page), { timeout: 5000 })
      .toBeLessThanOrEqual(40);
    // 最早已加载的是第 281 条（seed 取 archive 的末尾 120 条），游标就是它的 createdAt。
    // 它同时是"前插不跳位"的锚点：合并成功后它还该停在视窗上沿附近。
    const oldest = pane(page).getByText('第 281 条：这块的口径再对一次');

    // 一格一格往上滚，而不是一把 `scrollTop = 0`：真实滚轮是分帧的，每帧都留给 scroll 事件、
    // 行高实测与补偿落地。直接赋值时"用户已经上翻"和"整页历史合并"会挤进同一帧，
    // 补偿读到的是上一帧的位置 —— 那不是线上链路，测出来的跳位也没法定性。
    //
    // **合上这一页就停手**：`history` 是 120ms 之后回帧的，而 12 格滚轮（14400px）远超"滚到顶"
    // 所需的那点距离 —— 不停手的话，补偿刚把锚点放回视窗上沿，后面几格滚轮又接着往更旧的历史里走，
    // 锚点掉出窗口是**正确行为**，却让它取决于"回帧撞上第几格"。实测把 12 格全滚完，
    // 三个引擎都会停在第 8–24 行（锚点在第 31 行），只有 chromium/webkit 赢在时序够快：
    // 那是一条看运气的断言，不是证据。
    await pane(page).locator(VIEWPORT).hover();
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, -1200);
      await page.waitForTimeout(60);
      if ((await loadedCount(page)) > 120) break;
    }

    // 翻页请求由"滚到顶"触发：更早的消息在上方，在底部请求只会不断往前插
    await expect(countBadge(page)).toContainText('150 条（虚拟列表）', {
      timeout: 15_000,
    });

    // 前插不跳位：锚点那条还在窗口里（虚拟列表只渲染窗口 ± overscan，掉了就是真跳了）
    await expect(oldest).toBeVisible();
    // 也不许被拽回底部：这 30 条全在视窗上方，位置该留在历史那一头
    expect(await distanceToBottom(page)()).toBeGreaterThan(500);
    await expect(
      pane(page).getByText('第 400 条：这块的口径再对一次'),
    ).toBeHidden();

    // 不连发第二页：`history` 现在延时 120ms 回帧，"在途"这个时间窗真的存在了，
    // 停在顶上反复触发也只该拿到一页 —— 抓的结果是"同一页没被拉下来两遍"。
    // 旗标本身由包内单测「翻到顶才请求上一页，停在顶上重复滚动不连发」与
    // `use-im` 里那条 `loadHistory` 二次调用返回 false 的用例守着。
    await page.waitForTimeout(800);
    await expect(countBadge(page)).toContainText('150 条（虚拟列表）');

    // 翻旧消息不该翻出红点，也不该把会话顶到列表前面：未读口径与 `lastMessageAt` 都不许动
    await expect(
      conversation(page, 'c-single').locator('[data-unread-count]'),
    ).toHaveCount(0);
    await expect(
      panel(page).locator('[data-conversation-id]').first(),
    ).toHaveAttribute('data-conversation-id', 'c-single');

    expect(errors.errors).toStrictEqual([]);
    errors.stop();
  });
});
