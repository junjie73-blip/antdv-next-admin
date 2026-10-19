import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * `Listy` 虚拟滚动模式的浏览器契约。
 *
 * 单测（`packages/core/ui-kit/common-ui/__tests__/listy-virtual.test.ts`）只能钉状态：
 * jsdom 里 `clientHeight` 与 `offsetHeight` 恒为 0，滚动几何全是假的。
 * 这里量真东西，回答四个只有浏览器能答的问题：
 * 1. 万级数据下 DOM 里到底挂了多少行（虚拟是否真的生效，而不是"看起来生效"）；
 * 2. 行的**实际**高度是否等于算术高度（固定模式下内联高度真的把行钉死了没有）；
 * 3. 滚动条长度与占位块是否拼得上（`marginTop + height == 内容总高`，差一点就是滚不动/滚过头）；
 * 4. 容器尺寸变化后窗口会不会自己重算（这条完全依赖 ResizeObserver）。
 *
 * 示例页把可读状态写在 `[data-testid="listy-stats"]` 的 `data-*` 上，
 * 所以断言读属性而不是解析中文文案 —— 文案改了用例不该跟着改。
 */

const LISTY_PATH = '/components/listy';
/** 与示例页一致：20 000 条 × 48px */
const TOTAL = 20_000;
const ITEM_HEIGHT = 48;
const CONTENT_HEIGHT = TOTAL * ITEM_HEIGHT;
/** 窗口行数上限：视口容量 + 上下 overscan，与数据量无关 */
const ROW_LIMIT = 30;

function listBox(page: Page, demo: string): Locator {
  return page.locator(`[data-demo="${demo}"]`);
}

/** 滚动视口：虚拟模式才有内联高度与 `overflow-y` */
function viewport(box: Locator): Locator {
  return box.locator('[data-listy-viewport]');
}

function rows(box: Locator): Locator {
  return box.locator('ul.listy__rows > li');
}

function stats(page: Page): Locator {
  return page.getByTestId('listy-stats');
}

/** 读一个 `data-*` 数字，读不到就交给 Playwright 轮询（避免手写 sleep） */
async function statNumber(page: Page, name: string): Promise<number> {
  const value = await stats(page).getAttribute(`data-${name}`);
  return Number(value);
}

/** 把容器滚到某个像素位置，并等这一次滚动真的被组件看见（`data-top` 追上来） */
async function scrollToPixel(box: Locator, offset: number) {
  const page = box.page();
  await viewport(box).evaluate((el, top) => {
    el.scrollTop = top;
  }, offset);
  await expect
    .poll(() => statNumber(page, 'top'), { timeout: 5000 })
    .toBe(offset);
}

test.describe('Listy 虚拟滚动', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('万级数据只挂窗口内的行，行高与占位块是同一把尺', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, LISTY_PATH);

    const fixed = listBox(page, 'virtual-fixed');
    const rendered = rows(fixed);
    await expect(rendered.first()).toBeVisible();
    const count = await rendered.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(ROW_LIMIT);
    // 页面报的行数与 DOM 数一致：暴露的 `visibleItems` 没有说谎
    await expect(stats(page)).toHaveAttribute('data-rendered', String(count));

    // 内联高度真的把行钉死（border-box，含内边距），算术高度才敢直接拿来用
    const heights = await rendered.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    expect(new Set(heights)).toEqual(new Set([ITEM_HEIGHT]));

    // 占位块：窗口之前的偏移 + 剩下的尾巴 = 内容总高
    const spacer = await fixed
      .locator('ul.listy__rows')
      .evaluate((el) => ({
        height: Number.parseFloat(el.style.height || '0'),
        offset: Number.parseFloat(el.style.marginTop || '0'),
      }));
    expect(spacer.height + spacer.offset).toBe(CONTENT_HEIGHT);
    // 容器自己能滚到那个高度，说明滚动条不是"算出来的"而是真的存在
    await expect
      .poll(() =>
        viewport(fixed).evaluate((el) => el.scrollHeight - el.clientHeight),
      )
      .toBeGreaterThan(CONTENT_HEIGHT - 1000);
    await expect(stats(page)).toHaveAttribute('data-total', String(CONTENT_HEIGHT));
    expect(errors.errors).toEqual([]);
  });

  test('滚到中段：窗口跟着走，上下都补了 overscan', async ({ page }) => {
    await go(page, LISTY_PATH);
    const fixed = listBox(page, 'virtual-fixed');

    // 第 1000 行的顶部在 48 000px；overscan 5 让窗口从 995 开始
    await scrollToPixel(fixed, 1000 * ITEM_HEIGHT);
    await expect(stats(page)).toHaveAttribute('data-start', '995');

    const indices = await rows(fixed).evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).dataset.listyIndex)),
    );
    expect(indices[0]).toBe(995);
    // 连续递增的绝对下标：中间不能断档，也不能把窗口内序号当成下标
    expect(indices).toEqual(
      Array.from({ length: indices.length }, (_, offset) => 995 + offset),
    );
    // 视口容量那几行 + 下侧 overscan 都在，末行下标由容量决定，这里只要求盖到 1006
    expect(indices.at(-1)!).toBeGreaterThanOrEqual(1006);
    expect(indices.length).toBeLessThan(ROW_LIMIT);
    // 被滚过去的那些行确实不在 DOM 里
    await expect(
      fixed.locator('[data-listy-index="0"]'),
    ).toHaveCount(0);
  });

  test('scrollToIndex 把目标行送到窗口顶部（平滑滚动也要落准）', async ({ page }) => {
    await go(page, LISTY_PATH);
    const fixed = listBox(page, 'virtual-fixed');
    await page.getByRole('button', { name: '跳到 #10000' }).click();

    await expect(stats(page)).toHaveAttribute('data-start', '9995', {
      timeout: 5000,
    });
    const target = fixed.locator('[data-listy-index="10000"]');
    await expect(target).toBeInViewport();
    await expect(target).toContainText('条目 10000');
    // `@scroll` 是随位置发出的，跳一次至少抛过一条
    expect(await statNumber(page, 'events')).toBeGreaterThan(0);
  });

  test('滚到底：末行真的可见，进度到 1', async ({ page }) => {
    await go(page, LISTY_PATH);
    const fixed = listBox(page, 'virtual-fixed');
    await page.getByRole('button', { exact: true, name: '底部' }).click();
    // 点按钮会把页面滚到卡片头部，320px 的列表可能整块落到折线以下；
    // `toBeInViewport` 量的是与**页面视口**的交集，所以先把列表拉回来
    await viewport(fixed).scrollIntoViewIfNeeded();

    await expect(stats(page)).toHaveAttribute('data-end', String(TOTAL - 1), {
      timeout: 5000,
    });
    await expect(
      fixed.locator(`[data-listy-index="${TOTAL - 1}"]`),
    ).toBeInViewport();
    expect(await statNumber(page, 'progress')).toBeCloseTo(1, 5);
    // 末行贴住窗口底部时不该还有空隙：末尾不再补 overscan
    const box = await viewport(fixed).boundingBox();
    const last = await fixed
      .locator(`[data-listy-index="${TOTAL - 1}"]`)
      .boundingBox();
    expect(last).not.toBeNull();
    expect(Math.round(box!.y + box!.height - (last!.y + last!.height))).toBeLessThan(
      ITEM_HEIGHT,
    );
  });

  test('容器变矮，窗口行数跟着变少（ResizeObserver 自动重算）', async ({ page }) => {
    await go(page, LISTY_PATH);
    const fixed = listBox(page, 'virtual-fixed');
    const tall = await rows(fixed).count();
    const tallHeight = await viewport(fixed).evaluate((el) => el.clientHeight);
    expect(tallHeight).toBe(320);

    await page.getByRole('button', { name: /^视口/ }).click();
    await expect
      .poll(() => viewport(fixed).evaluate((el) => el.clientHeight))
      .toBe(200);
    const short = await rows(fixed).count();
    expect(short).toBeLessThan(tall);
    // 行数变了但占位块底边不动：总高只由数据决定，与视口高度无关
    await expect(stats(page)).toHaveAttribute(
      'data-total',
      String(CONTENT_HEIGHT),
    );
  });

  test('动态高度：行由内容撑开，实测值回灌进滚动算术', async ({ page }) => {
    await go(page, LISTY_PATH);
    const dynamic = listBox(page, 'virtual-dynamic');
    const rendered = rows(dynamic);
    await expect(rendered.first()).toBeVisible();

    // 没有任何内联高度，行高完全由内容决定
    const inline = await rendered.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).style.height),
    );
    expect(inline.every((value) => value === '')).toBe(true);

    const heights = await rendered.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    // 说明文字按行号重复 1–5 遍，所以同一屏里至少能看到两种高度
    expect(new Set(heights).size).toBeGreaterThan(1);

    // 实测比 52px 的估算高，回灌之后总高一定越过"全按估算算"的天花板
    const measuredTotal = Number(
      await page.getByTestId('listy-dynamic-total').getAttribute('data-height'),
    );
    expect(measuredTotal).toBeGreaterThan(TOTAL * 52);
    // 行与行之间不留缝：窗口偏移等于前面所有行的高度之和（同一套算术）
    const spacer = await dynamic
      .locator('ul.listy__rows')
      .evaluate((el) => ({
        height: Number.parseFloat(el.style.height || '0'),
        offset: Number.parseFloat(el.style.marginTop || '0'),
      }));
    expect(spacer.height + spacer.offset).toBe(measuredTotal);
  });

  test('直排对照：不开 virtual 就全量渲染，外层不接管滚动', async ({ page }) => {
    await go(page, LISTY_PATH);
    const plain = listBox(page, 'plain-30');
    await expect(rows(plain)).toHaveCount(30);
    const metrics = await viewport(plain).evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      scrollable: el.scrollHeight - el.clientHeight,
    }));
    expect(metrics.overflowY).toBe('visible');
    expect(metrics.scrollable).toBe(0);
  });

  test('连续滚动 30 段：行数不增长，每段处理都在一帧量级', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, LISTY_PATH);
    const fixed = listBox(page, 'virtual-fixed');
    await expect(rows(fixed).first()).toBeVisible();

    // 一次写一个位置，每段之间等一帧：测到的就是"滚动响应 + 窗口重渲染"的耗时
    const durations = await viewport(fixed).evaluate(
      (el) =>
        new Promise<number[]>((resolve) => {
          const steps = Array.from(
            { length: 30 },
            (_, index) => 20_000 + index * 30_000,
          );
          const out: number[] = [];
          let cursor = 0;
          let last = performance.now();
          const step = () => {
            if (cursor >= steps.length) {
              resolve(out);
              return;
            }
            el.scrollTop = steps[cursor++]!;
            requestAnimationFrame(() => {
              const now = performance.now();
              out.push(now - last);
              last = now;
              step();
            });
          };
          step();
        }),
    );

    expect(durations).toHaveLength(30);
    // 这一条抓的是"滚动处理退化成二次方"，不是帧率基准：实测 Chromium 每段十几毫秒，
    // WebKit 冷启动（dev 下边跑边编译）能到 110ms，所以留 250ms 的余量。
    // 真退化时这里是几秒量级；机器被打满也会假红，红了先复跑再改代码。
    expect(Math.max(...durations)).toBeLessThan(250);
    const count = await rows(fixed).count();
    expect(count).toBeLessThan(ROW_LIMIT);
    await expect(stats(page)).toHaveAttribute('data-rendered', String(count));
    // 滚完还在原处：窗口下标与 DOM 首行仍是同一件事
    const start = await statNumber(page, 'start');
    expect(
      await fixed
        .locator('ul.listy__rows > li')
        .first()
        .getAttribute('data-listy-index'),
    ).toBe(String(start));
    expect(errors.errors).toEqual([]);
  });
});
