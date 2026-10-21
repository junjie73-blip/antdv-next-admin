import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  cssVar,
  go,
  openPreferenceDrawer,
  signIn,
  watchErrors,
} from './utils/app';

/**
 * 头像下拉里新增的「锁屏」在浏览器里的表现。
 *
 * 单测（`packages/layouts/__tests__/user-dropdown-lock.test.ts`）钉的是结构：
 * 入口是数据驱动菜单里多出来的一项、状态机三条解锁路径都汇到 `unlock()`、
 * 样式表里没有 px 圆角、阈值判定上下两侧各打一次。jsdom 不解析 CSS 变量，
 * 也算不出 rem —— 所以**"不同屏幕尺寸下圆角到底一不一致"只能在这里量**。
 *
 * 分工按能力划：
 * - 计算值（半径、把手位移、遮罩命中测试、滚动是否真的被钉住）→ 这里量；
 * - 阈值两侧（96 默认档在真机上拖 60 / 拖 130）→ 这里量，别的阈值档位由单测换 props 打；
 * - 还原（解锁后 `overflow` 回到原样、监听器摘掉）→ 两边都钉，这里只看得到真结果。
 */

/** 视口高度全程同一个值，卡片"垂直居中"的判据要靠它 */
const VIEWPORT_HEIGHT = 900;

/** 默认下拉阈值（`lock-screen.vue` 的 `UNLOCK_PULL_THRESHOLD`），改成 prop 要两边一起改 */
const PULL_THRESHOLD = 96;

function screen(page: Page) {
  return page.locator('[data-testid="lock-screen"]');
}

function handle(page: Page) {
  return page.locator('[data-testid="lock-pull-handle"]');
}

/** 内容区那枚真正滚动的视口（外壳把内容区交给 reka 的 ScrollArea） */
function contentViewport(page: Page) {
  return page
    .locator('[data-layout-region="content"] [data-reka-scroll-area-viewport]')
    .first();
}

/**
 * 从头像下拉里点「锁屏」，并等到页面重新可交互。
 *
 * 等 `body` 的 `pointer-events` 还原是必须的：reka 的菜单是模态浮层，
 * 选中一项之后还要跑完退场（约 200ms），这期间它把 `pointer-events: none`
 * 写在 `body` 上 —— 锁屏遮罩挂在 body 之下，跟着一起点不动。
 * 不等这一句就拖把手，量到的是"拖不动"而不是"阈值算错"（窄屏上必红，
 * 因为窄屏的往返更快、恰好落在退场窗口里）。
 */
async function lock(page: Page) {
  await page.locator('[data-testid="header-user"]').click();
  await page.locator('[data-testid="user-menu-lock"]').click();
  await expect(screen(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.pointerEvents), {
      message: '下拉菜单的退场还压着 body 的 pointer-events',
    })
    .toBe('');
}

/** 点遮罩上的「解锁屏幕」 */
async function unlockByButton(page: Page) {
  await page.locator('[data-testid="lock-unlock-button"]').click();
  await expect(screen(page)).toHaveCount(0);
}

/**
 * 一次性读回遮罩上四个圆角面 + 圆角的原始来源。
 *
 * `inlineCardRadius` 取的是卡上内联的 `--lock-card-radius` 字面量（由 `useCssVar`
 * 写进去）：计算值已经被浏览器换成 px 了，只有内联串还能证明"写的是 rem 派生量、
 * 不是 px"。`rootFontSize` 用来把 rem 折成 px，别让 16 这个数字散在断言里。
 */
function readRadii(page: Page) {
  return page.evaluate(() => {
    /** 四角里取左上/右上，顺带钉"不是只有一角对" */
    const radiusOf = (selector: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`遮罩里找不到 ${selector}`);
      const cs = getComputedStyle(el);
      return {
        topLeft: Number.parseFloat(cs.borderTopLeftRadius),
        topRight: Number.parseFloat(cs.borderTopRightRadius),
      };
    };
    /**
     * 正圆不看 `rounded-full` 的字面量（计算值里是个极大的数），看半径够不够半边。
     * `getComputedStyle().width` 是带单位的串，得先 parseFloat 才能参与比较。
     */
    const isCircle = (selector: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return false;
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        Number.parseFloat(cs.borderTopLeftRadius) >=
          Number.parseFloat(cs.width) / 2 - 1 &&
        Math.abs(box.width - box.height) <= 1
      );
    };

    const card = document.querySelector<HTMLElement>('.lock-card');
    if (!card) throw new Error('遮罩里没有锁屏卡片');
    return {
      badgeCircle: isCircle('.lock-badge'),
      button: radiusOf('.lock-button'),
      card: radiusOf('.lock-card'),
      handle: radiusOf('.lock-handle'),
      handleCircle: isCircle('.lock-handle'),
      inlineBase: getComputedStyle(document.documentElement)
        .getPropertyValue('--radius')
        .trim(),
      inlineCardRadius: card.style
        .getPropertyValue('--lock-card-radius')
        .trim(),
      inlineHandleRadius: card.style
        .getPropertyValue('--lock-handle-radius')
        .trim(),
      rootFontSize: Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      ),
    };
  });
}

/**
 * 按住把手向下拖 `distance` 像素，中途（松手前）读一次进度与位移回来。
 *
 * 中途那次读取是关键：`--lock-pull` 只应等于"拖到的比例"，把手的 `translateY`
 * 只应等于 `pull × pullDistance`。只在松手后看结果，就漏掉了"拖一半已经算解锁"
 * 这种阈值算错的实现。
 */
async function pullHandle(page: Page, distance: number) {
  const box = await handle(page).boundingBox();
  if (!box) throw new Error('锁屏把手没渲染出来');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + distance / 2, { steps: 6 });

  const mid = await readHandle(page);

  await page.mouse.move(cx, cy + distance, { steps: 6 });
  await page.mouse.up();
  return mid;
}

/** 把手回到原位（进度归零）时的几何 */
function readHandle(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.lock-card');
    const knob = document.querySelector<HTMLElement>('.lock-handle');
    if (!card || !knob) throw new Error('遮罩已不在场');
    return {
      pull: Number.parseFloat(
        getComputedStyle(card).getPropertyValue('--lock-pull') || '0',
      ),
      translateY: new DOMMatrixReadOnly(getComputedStyle(knob).transform).f,
    };
  });
}

test.describe('锁屏', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      height: VIEWPORT_HEIGHT,
      width: 1440,
    });
  });

  test('遮罩盖满视口，把滚动与页面交互一起挡在下面', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/user');

    /*
     * 内容区得真的能滚，"锁住后滚不动"才有意义。
     *
     * 轮询而不是读一次：`/system/user` 的行是 mock 接口回来以后才把内容撑高的，
     * 每个引擎第一条用例还要付一次现场编译（WebKit 冷跑实测几十秒），
     * 单帧读一次会把"数据还没到"读成"这页不滚"—— 前者等一会儿就成立，后者永远不成立。
     */
    await expect
      .poll(
        () =>
          contentViewport(page).evaluate(
            (el) => el.scrollHeight > el.clientHeight + 1,
          ),
        {
          message: '内容区没有可滚内容，换页再试',
          timeout: 30_000,
        },
      )
      .toBe(true);

    await lock(page);

    // 1. 几何铺满整个视口（Teleport 到 body，不吃 header 的层叠上下文）
    const box = await screen(page).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.y)).toBe(0);
      expect(Math.round(box.width)).toBe(1440);
      expect(Math.round(box.height)).toBe(VIEWPORT_HEIGHT);
    }

    // 2. 两把滚动锁都落下：内容区视口 + `<html>`
    await expect
      .poll(() =>
        contentViewport(page).evaluate((el) => getComputedStyle(el).overflowY),
      )
      .toBe('hidden');
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).overflowY,
      ),
      '<html> 没锁住的话滚轮还能推动整页',
    ).toBe('hidden');

    // 3. 滚轮真的滚不动：指针停在内容区中央（遮罩之上）滚 300px
    await page.mouse.move(720, 500);
    await page.mouse.wheel(0, 300);
    expect(
      await contentViewport(page).evaluate((el) => el.scrollTop),
      '锁屏期间内容区仍能滚动',
    ).toBe(0);

    // 4. 默认交互被挡：顶栏头像与页面里的按钮，命中测试都只撞到遮罩
    const blocked = await page.evaluate(() => {
      const probe = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return 'missing';
        const rect = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          Math.round(rect.x + rect.width / 2),
          Math.round(rect.y + rect.height / 2),
        );
        return hit?.closest('[data-testid="lock-screen"]') ? 'masked' : 'live';
      };
      return {
        headerUser: probe('[data-testid="header-user"]'),
        pageButton: probe(
          '[data-layout-region="content"] button:not([data-testid="lock-unlock-button"])',
        ),
      };
    });
    expect(blocked.headerUser, '锁屏期间点头像还能开下拉').toBe('masked');
    expect(blocked.pageButton, '锁屏期间页面按钮仍可点').toBe('masked');

    // 5. 解锁后一切还原：滚动锁放开，同一个滚轮动作立刻生效
    await unlockByButton(page);
    await page.mouse.move(720, 500);
    await page.mouse.wheel(0, 300);
    await expect
      .poll(() => contentViewport(page).evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(
      await contentViewport(page).evaluate(
        (el) => getComputedStyle(el).overflowY,
      ),
      '解锁后 overflow 没还回去',
    ).not.toBe('hidden');

    expect(errors.errors).toEqual([]);
  });

  test('按任意键也能解锁，且这一键不会落进页面', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/user');

    await lock(page);
    await page.keyboard.press('a');
    await expect(screen(page), '按任意键那条路径没放行').toHaveCount(0);

    // 摘干净：锁屏期间的 capture 监听器不能留在 window 上
    await page.keyboard.press('b');
    await expect(screen(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.style.overflow),
      '解锁后 <html> 还带着滚动锁',
    ).not.toBe('hidden');

    expect(errors.errors).toEqual([]);
  });

  test('下拉解锁只看阈值：60px 归零，130px 放行', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/user');

    // 未到阈值：拖到中途（30px）进度是 30/96、把手跟着走 30px，松手后归零且不解锁
    await lock(page);
    const short = await pullHandle(page, 60);
    expect(short.pull, '进度没有按阈值归一').toBeCloseTo(
      30 / PULL_THRESHOLD,
      1,
    );
    expect(short.translateY).toBeCloseTo(30, 0);
    await expect(screen(page), '没到阈值就放行了').toBeVisible();
    const reset = await readHandle(page);
    expect(reset.pull).toBe(0);
    expect(reset.translateY, '松手没回到原位').toBeCloseTo(0, 0);

    // 过阈值：拖 130 > 96，松手即解锁
    await pullHandle(page, 130);
    await expect(screen(page), '拖过阈值没有解锁').toHaveCount(0);

    expect(errors.errors).toEqual([]);
  });

  test('圆角在不同屏幕尺寸与不同刻度下都跟着同一份 rem 基准', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/user');

    /*
     * 360 / 768 / 1440 三档各锁一次。基准写在 `<html>` 上（`--radius`，
     * 默认 `1rem`），卡片是它的 1.5 倍、按钮与把手跟基准 —— 三档量出来的
     * 像素值必须完全相同：宽屏与窄屏拿到不同半径，就是有人把圆角写成了视口相关的量。
     */
    const rootFontSize = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(rootFontSize, '没读到根字号，后面所有换算都是空的').toBeGreaterThan(
      0,
    );

    const seen: Array<{
      read: Awaited<ReturnType<typeof readRadii>>;
      width: number;
    }> = [];
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });
      await page.waitForTimeout(200); // 窄屏判定走 useWindowSize，重排要一帧
      await lock(page);
      seen.push({ read: await readRadii(page), width });
      await unlockByButton(page);
    }

    for (const { read, width } of seen) {
      // 倍率没动过，三档都该落在同一个根字号上（rem 链路唯一的公共因子）
      expect(read.rootFontSize, `${width}px 下根字号跟着视口变了`).toBe(
        rootFontSize,
      );
      expect(read.card.topLeft, `${width}px 卡片半径不对`).toBeCloseTo(
        rootFontSize * 1.5,
        0,
      );
      /*
       * 按钮跟基准。把手不吃这条数字判据：它是 `rounded-full` 的正圆，
       * 计算值是个天文数字，圆的身份由下面 `handleCircle` 判（半径 ≥ 半边）。
       */
      expect(read.button.topLeft, `${width}px 按钮半径不对`).toBeCloseTo(
        rootFontSize,
        0,
      );
      // 四角一致（不是只有左上角对），且圆形件是真圆（isCircle 里连正方形一起判了）
      expect(read.card.topRight).toBeCloseTo(read.card.topLeft, 2);
      expect(read.handleCircle, `${width}px 把手不是正圆`).toBe(true);
      expect(read.badgeCircle, `${width}px 徽标不是正圆`).toBe(true);
      // 写侧口径：内联的是 rem 派生量，不许出现 px
      expect(read.inlineBase, `${width}px 基准没落成 rem`).toBe('1rem');
      expect(read.inlineCardRadius).toContain('rem');
      expect(read.inlineCardRadius).not.toContain('px');
      expect(read.inlineHandleRadius).toContain('rem');
      expect(read.inlineHandleRadius).not.toContain('px');
    }

    /*
     * 三档之间不许出现任何一档的半径漂移。用集合大小判而不是首尾对比，
     * 是因为"全读到 0"这种漂移也会让首尾相等 —— 下面那行非零反证补上这个洞。
     */
    const cardRadii = seen.map((item) => item.read.card.topLeft);
    expect(
      new Set(cardRadii).size,
      `各视口卡片半径不一致：${cardRadii.join(' / ')}`,
    ).toBe(1);
    expect(cardRadii[0], '卡片压根没有圆角').toBeGreaterThan(0);
    const handleRadii = seen.map((item) => item.read.handle.topLeft);
    expect(new Set(handleRadii).size, '各视口把手半径不一致').toBe(1);

    /*
     * 换一档刻度（0.5）再量一次：卡片应当整体缩到 12px、按钮与把手 8px，
     * 而内联串仍是 rem —— 倍率改的是 rem 的系数，不是某处乘了个 px 常数。
     */
    const drawer = await openPreferenceDrawer(page, '外观');
    await drawer.locator('.grid.grid-cols-5 > button').nth(2).click(); // 0.5
    await expect.poll(() => cssVar(page, '--radius')).toBe('0.5rem');
    await closePreferenceDrawer(page);

    await lock(page);
    const half = await readRadii(page);
    expect(half.card.topLeft, '刻度 0.5 时卡片半径没有等比缩').toBeCloseTo(
      rootFontSize * 1.5 * 0.5,
      0,
    );
    expect(half.button.topLeft).toBeCloseTo(rootFontSize * 0.5, 0);
    expect(half.inlineCardRadius).toContain('rem');
    expect(half.inlineCardRadius).not.toContain('px');
    await unlockByButton(page);

    // 恢复默认刻度，别把 0.5 留给后面的用例
    const reset = await openPreferenceDrawer(page, '外观');
    await reset.locator('.grid.grid-cols-5 > button').nth(4).click();
    await closePreferenceDrawer(page);

    expect(errors.errors).toEqual([]);
  });

  test('窄屏上锁屏照样可用，卡片收得进视口', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ height: 720, width: 390 });
    await signIn(page);

    await lock(page);
    const card = await page.locator('.lock-card').boundingBox();
    expect(card).not.toBeNull();
    if (card) {
      // `w-[min(320px,calc(100vw-32px))]`：390 宽下取 320，左右各留 35
      expect(card.width).toBeLessThanOrEqual(390);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(390);
      expect(Math.round(card.y + card.height / 2)).toBeCloseTo(360, -1);
    }

    // 卡片里的操作件都在视口内点得到（把手拖着不超出下缘）
    const knob = await handle(page).boundingBox();
    expect(knob).not.toBeNull();
    if (knob) {
      expect(knob.y).toBeGreaterThan(0);
      expect(knob.y + knob.height).toBeLessThan(720);
    }

    await pullHandle(page, 120);
    await expect(screen(page), '窄屏上拖把手没能解锁').toHaveCount(0);

    expect(errors.errors).toEqual([]);
  });

  test('解锁后不留痕迹：遮罩被摘掉，滚动条与页面恢复交互', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/user');

    await lock(page);
    await unlockByButton(page);

    // 遮罩整体从 DOM 摘掉（不是靠 opacity 藏起来）
    await expect(page.locator('.lock-card')).toHaveCount(0);
    await expect(handle(page)).toHaveCount(0);

    // 再锁一次仍然正常：状态机可重复，第二次的滚动锁落在新的滚动盒上
    await lock(page);
    await expect
      .poll(() =>
        contentViewport(page).evaluate((el) => getComputedStyle(el).overflowY),
      )
      .toBe('hidden');
    await page.keyboard.press('Enter');
    await expect(screen(page)).toHaveCount(0);

    expect(errors.errors).toEqual([]);
  });
});
