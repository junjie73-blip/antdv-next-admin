import { expect, test } from '@playwright/test';

import { go, region, signIn } from './utils/app';

/**
 * UI 适配两条口径的端到端锚点：
 *
 * 1. **圆角只有一个基准**。基准固定 16px（`BORDER_RADIUS_BASE`），`rounded-*` 七档全部
 *    由它按比例派生（0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3）。断言读的是浏览器算出来的
 *    计算样式，不是 CSS 里的字符串 —— 只有算出来的值能证明"动基准时整条刻度一起缩放"，
 *    不会出现卡片圆角变了、按钮没变那种两套尺度。
 * 2. **滚动条只在真正滚动的过程中出现**。默认走 reka ScrollArea 的 `scroll` 显隐：
 *    空闲和指针停留都不亮条，停止滚动 `hideDelay`（默认 800ms）后收起。
 *    同时钉住"侧边栏不写手写滚动条样式"：滚动盒必须是 `scrollbar-width: none`
 *    （原生条由 reka 关掉），页面里也不该再有自绘条之外的可滚元素。
 */

/** `rounded-*` 七档相对基准的比例，与 `design/src/token/index.css` 的刻度一一对应 */
const RADIUS_RATIO: Record<string, number> = {
  'rounded-2xl': 2,
  'rounded-3xl': 3,
  'rounded-lg': 1,
  'rounded-md': 0.75,
  'rounded-sm': 0.5,
  'rounded-xl': 1.5,
  'rounded-xs': 0.25,
};

/** 全站唯一的圆角基准（px），改这个值要同时改 `BORDER_RADIUS_BASE` 与两处 token */
const BASELINE = 16;

/**
 * 读侧边栏滚动盒与它的轨道状态。
 *
 * `bars` 只列当前挂在 DOM 上的轨道：reka 的 `scroll` 型用 Presence 控制显隐，
 * 不该显示时元素直接不存在（不是靠 opacity 藏起来），所以判"没亮"用空数组。
 */
function readSidebarScroll(root: HTMLElement) {
  const viewport = root.querySelector(
    '[data-reka-scroll-area-viewport]',
  ) as HTMLElement | null;
  if (!viewport) throw new Error('侧边栏里没有内置 Scrollbar 的滚动盒');
  const area = viewport.closest('[data-slot="scroll-area"]') as HTMLElement;
  const bars = Array.from(
    area.querySelectorAll<HTMLElement>('[data-slot="scroll-area-scrollbar"]'),
  ).map((bar) => ({
    orientation: bar.dataset.orientation ?? '',
    state: bar.dataset.state ?? '',
  }));
  const style = getComputedStyle(viewport);
  return {
    bars,
    clientHeight: viewport.clientHeight,
    overflowY: style.overflowY,
    scrollbarWidth: style.scrollbarWidth,
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
  };
}

test.describe('圆角基准与侧边栏滚动条', () => {
  test('七档圆角全部由 16px 基准按比例派生', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    const appRadius = await page.evaluate(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--app-border-radius')
          .trim(),
    );
    expect(appRadius, '偏好倍率 1 时基准必须是 16px').toBe('16px');

    const measured = await page.evaluate((classes) => {
      const probe = (cls: string) => {
        const el = document.createElement('div');
        el.className = cls;
        document.body.append(el);
        const value = getComputedStyle(el).borderTopLeftRadius;
        el.remove();
        return value;
      };
      return Object.fromEntries(
        classes.map((cls) => [cls, probe(cls)] as const),
      ) as Record<string, string>;
    }, Object.keys(RADIUS_RATIO));

    for (const [cls, ratio] of Object.entries(RADIUS_RATIO)) {
      expect(
        measured[cls],
        `${cls} 应该是基准 ${BASELINE}px 的 ${ratio} 倍`,
      ).toBe(`${Math.round(BASELINE * ratio * 100) / 100}px`);
    }

    // 刻度得落到真实组件上：卡片用 rounded-xl，量到的必须是同一个 24px
    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('border-top-left-radius', '24px');
  });

  test('侧边栏滚动条空闲不亮，滚动时出现、停下自动收起', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    /**
     * 压到 300px 高让菜单必然溢出（实测滚动盒 180px、内容 308px）。
     * 先登录再改视口：外壳在超短首屏下不挂载（停在加载态），那不是这条用例要验的东西。
     */
    await page.setViewportSize({ height: 300, width: 1280 });
    await page.waitForTimeout(600);

    const sidebar = region(page, 'sidebar');
    const read = () => sidebar.evaluate(readSidebarScroll);

    const idle = await read();
    expect(idle.overflowY).toBe('scroll');
    expect(idle.scrollbarWidth, '原生滚动条必须由 reka 关掉').toBe('none');
    expect(
      idle.scrollHeight,
      '菜单没溢出就无法验证滚动条显隐',
    ).toBeGreaterThan(idle.clientHeight);
    expect(idle.bars, '空闲时不该有轨道挂在 DOM 上').toEqual([]);

    const box = await sidebar.boundingBox();
    if (!box) throw new Error('侧边栏没有尺寸');
    // 指针全程停在侧边栏内部：换成 hover 型，轨道会因为这个而长亮
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(150);
    const during = await read();
    expect(during.scrollTop, '滚轮没滚动起来').toBeGreaterThan(0);
    expect(during.bars).toEqual([
      { orientation: 'vertical', state: 'visible' },
    ]);

    await page.waitForTimeout(1500);
    const settled = await read();
    expect(settled.bars, '停止滚动后应按 hideDelay 收起').toEqual([]);
    expect(settled.scrollTop, '收起时不该把位置弹回顶部').toBe(
      during.scrollTop,
    );

    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(150);
    const again = await read();
    expect(again.scrollTop).toBeLessThan(settled.scrollTop);
    expect(again.bars.map((bar) => bar.state)).toEqual(['visible']);
  });

  test('页面里没有自绘条之外的滚动区（统一走内置 Scrollbar）', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await page.setViewportSize({ height: 300, width: 1280 });
    await page.waitForTimeout(600);

    const leaks = await page.evaluate(() => {
      const out: string[] = [];
      for (const node of Array.from(document.querySelectorAll('*'))) {
        const el = node as HTMLElement;
        if (el.scrollHeight <= el.clientHeight + 2) continue;
        if (el.closest('[data-reka-scroll-area-viewport]')) continue;
        const style = getComputedStyle(el);
        const scrolls = (value: string) =>
          value === 'auto' || value === 'scroll';
        if (!scrolls(style.overflowY) && !scrolls(style.overflowX)) continue;
        out.push(`${el.tagName}.${el.className.toString().slice(0, 60)}`);
      }
      return out;
    });
    expect(leaks, '这些元素还在用原生滚动条').toEqual([]);
  });
});
