import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, setLayout, signIn } from './utils/app';

/**
 * 大屏要缩进**内容区**，而不是缩进视口。
 *
 * `useScreenAdapter` 早先按 `window.innerWidth/innerHeight` 算 scale：1440 视口下
 * scale=0.75、缩完正好 1440 宽，可内容区实际只有约 1198 宽 —— 右侧「资源使用率 /
 * 地区用户分布 / 服务与告警」整列被裁到视口外，还多出一条横向滚动条。
 * 更隐蔽的是侧栏折叠、标签页放大、「内容全屏」都只改内容区尺寸、不动视口，
 * 只听 `window.resize` 就永远停在旧比例。
 *
 * 三条判据都刻意避开 `getBoundingClientRect()` 与缩放后坐标：量容器自己用
 * `clientWidth/clientHeight`（布局尺寸，不含 scale），溢出用滚动盒的
 * `scrollWidth - clientWidth`（真溢出才会 > 0）。
 */

interface Fit {
  /** 内容区滚动盒的横向溢出像素，>0 就是被撑出去了 */
  overflowX: number;
  /** 缩放后大屏右边缘超出容器右边缘的像素，>0 就是右侧被裁 */
  rightOverflow: number;
  scale: number;
  /** 按"容器宽 / 设计稿宽"应有的 scale，用来抓"还在按 window 算"的实现 */
  scaleIfContainer: number;
}

async function fit(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const container = document.getElementById('screen-container') as HTMLElement;
    const content = document.getElementById('screen-content') as HTMLElement;
    const wrap = container.closest('.scrollbar__wrap') as HTMLElement;
    const cols = [...document.querySelectorAll('#screen-content [class*="col-span-3"]')];
    const rightCard = cols.at(-1) as HTMLElement;
    return {
      overflowX: wrap.scrollWidth - wrap.clientWidth,
      rightOverflow: Math.round(
        rightCard.getBoundingClientRect().right - container.getBoundingClientRect().right,
      ),
      scale: Number.parseFloat(
        getComputedStyle(content).transform.match(/matrix\(([\d.]+)/)?.[1] ?? '0',
      ),
      scaleIfContainer: container.clientWidth / 1920,
    };
  });
}

/** 等缩放器真的写过一次 transform，别拿首帧的空白当结论 */
async function expectScaled(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => document.getElementById('screen-content')?.style.transform ?? '',
        ),
      { timeout: 40_000 },
    )
    .toContain('scale');
}

test.describe('大屏缩进内容区', () => {
  test('右侧整列不被裁掉，且没有横向滚动条', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await go(page, '/screen/monitor');
    await expectScaled(page);

    const result = await fit(page);
    expect(result.scale).toBeGreaterThan(0);
    expect(result.overflowX).toBeLessThanOrEqual(0);
    expect(result.rightOverflow).toBeLessThanOrEqual(1);
    // 短板可能是高度（窄视口下按高算），所以只要求"不超过容器宽"
    expect(result.scale * 1920).toBeLessThanOrEqual(
      (await page.evaluate(
        () => (document.getElementById('screen-container') as HTMLElement).clientWidth,
      )) + 1,
    );
  });

  /**
   * 折叠侧栏只加宽内容区，所以视口要选成"短板在宽度上"：
   * 1280x720 下可用高度只有约 540，scale 被 540/1080=0.5 钉死，
   * 折叠前后读数一样，用例就成了自证。给一个高视口，让宽度重新变成瓶颈。
   */
  test.describe('折叠侧栏', () => {
    test.use({ viewport: { height: 1300, width: 1600 } });

    test('只改内容区宽度，缩放也要跟着重算', async ({ page }) => {
      test.setTimeout(180_000);
      await signIn(page);
      await go(page, '/screen/monitor');
      await expectScaled(page);

      const before = await fit(page);
      expect(before.scale * 1920).toBeLessThanOrEqual(
        (await page.evaluate(
          () => (document.getElementById('screen-container') as HTMLElement).clientWidth,
        )) + 1,
      );

      await page.click('[data-layout-sidebar-collapse]');

      const samples: string[] = [];
      await expect
        .poll(
          async () => {
            const now = await fit(page);
            samples.push(`${before.scale.toFixed(4)}->${now.scale.toFixed(4)}`);
            return now.scale > before.scale + 0.001;
          },
          { timeout: 15_000 },
        )
        .toBe(true)
        .catch((error) => {
          console.log('scale samples', samples.join(' '));
          throw error;
        });

      const after = await fit(page);
      expect(after.overflowX).toBeLessThanOrEqual(0);
      expect(after.rightOverflow).toBeLessThanOrEqual(1);
    });
  });

  test('「内容全屏」时不留内边距，大屏铺满视口', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await go(page, '/screen/monitor');
    await expectScaled(page);

    await setLayout(page, 'full-content');
    const measure = () =>
      page.evaluate(() => {
        const container = document.getElementById('screen-container') as HTMLElement;
        const view = container.closest('.scrollbar__view') as HTMLElement;
        const wrap = container.closest('.scrollbar__wrap') as HTMLElement;
        return {
          overflowX: wrap.scrollWidth - wrap.clientWidth,
          padX: Number.parseFloat(getComputedStyle(view).paddingLeft),
          ratio: container.clientWidth / window.innerWidth,
        };
      });

    // 外壳淡出要时间，先等容器真的铺满视口，再判"没留内边距、没溢出"
    await expect
      .poll(() => measure().then((result) => result.ratio), { timeout: 20_000 })
      .toBeGreaterThan(0.98);

    const result = await measure();
    expect(result.padX).toBe(0);
    expect(result.overflowX).toBeLessThanOrEqual(0);
  });
});
