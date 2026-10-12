import { expect, test } from '@playwright/test';

import { go, signIn } from './utils/app';

/**
 * 大屏图表要跟着**容器**尺寸走。
 *
 * 只有 `window` 的 resize 监听是不够的：侧栏折叠、全屏、`useScreenAdapter` 重算
 * scale，这些都只改容器宽高、不动视口，图就停在旧尺寸上（轴标签被截断、右侧留白）。
 *
 * 三条被坑出来的写法：
 * 1. **认死一张图**（PV/UV 主图的容器）。`querySelector('canvas')` 取"第一张画布"
 *    会随渲染时机命中不同的小图，断言就变成随机的了；
 * 2. 缩容器和量尺寸用**同一个 locator 句柄**，不各查一次 DOM；
 * 3. 容器宽度取 `clientWidth`，不取 `getBoundingClientRect().width`：大屏根节点被
 *    `useScreenAdapter` 打了 `scale`，`getBoundingClientRect` 量的是缩放后的视觉尺寸
 *    （实测 908 的容器读成 605），和画布的 CSS 宽根本不是一个坐标系。
 *    同理，判据用 `canvas.style.width` 而不是 `canvas.width` —— 后者是后备缓冲的像素数，
 *    会被 devicePixelRatio 放大（Playwright 的 webkit 上下文 dpr=2，CSS 499 对应 998）。
 */

/** 主图容器（`ref="pvChartRef"`）：echarts 的画布挂在它里面 */
const PV_HOST = '[class*="min-h-[200px]"]';

test.describe('大屏图表自适应', () => {
  test('容器变窄后画布跟着改尺寸，全程没动过视口', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await go(page, '/screen/monitor');

    const host = page.locator(PV_HOST).first();
    await expect(host).toHaveCount(1);

    /** 容器与画布一起量，量的是同一个节点 */
    const measure = () =>
      host.evaluate((element) => {
        const canvas = element.querySelector(
          'canvas',
        ) as HTMLCanvasElement | null;
        return {
          canvas: Number.parseFloat(canvas?.style.width || '0') || -1,
          host: element.clientWidth,
        };
      });

    // 画布还没出现时 canvas 是 -1，先等这张图画出来
    await expect
      .poll(() => measure().then((result) => result.canvas), {
        timeout: 40_000,
      })
      .toBeGreaterThan(0);

    const initial = await measure();
    expect(initial.host).toBeGreaterThan(100);
    expect(initial.canvas).toBeLessThanOrEqual(initial.host + 2);

    // 内联样式压过 Tailwind 的 w-full：容器立刻变窄，视口一个字没改
    await host.evaluate((element) => {
      (element as HTMLElement).style.width = '55%';
    });

    // ResizeObserver 回调是异步的，用 poll 而不是睡固定时长
    const samples: string[] = [];
    await expect
      .poll(
        async () => {
          const { canvas, host: hostWidth } = await measure();
          samples.push(`${canvas}/${hostWidth}`);
          return (
            // 画布确实变小了：这一条把"根本没 resize"的假绿堵死。
            // 只写 `canvas <= host + 2` 是不够的——实测有一次容器读到 908 的瞬间
            // 恰好满足不等式，用例在没有修复的代码上绿了（8.4s 就过，快得可疑）。
            canvas > 0 &&
            canvas < initial.canvas - 100 &&
            // 贴住新容器：容许 echarts 取整带来的 3px
            Math.abs(canvas - hostWidth) <= 3
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true)
      .catch((error) => {
        // 三引擎的 ResizeObserver 时机不一样，把读数留在报告里，别只留一个 false
        console.log('initial', JSON.stringify(initial));
        console.log('samples', samples.slice(0, 6).join(' '));
        throw error;
      });
  });
});
