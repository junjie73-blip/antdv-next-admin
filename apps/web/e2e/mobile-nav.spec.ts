import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { navigate, region, setLayout, signIn, watchErrors } from './utils/app';

/**
 * 窄屏（360–767px）导航栏：菜单入口、开合动画、品牌位与右缘悬浮簇。
 *
 * 分档线取 768 是因为两处判据同源：`MOBILE_BREAKPOINT = 768`（layout-ui 的窄屏判定）
 * 与 Tailwind 的 `md`（768px）。于是 **767 是窄屏档的最后一档，768 起就是桌面档**，
 * 这条线两侧的期望行为要整体翻转（悬浮簇消失、小部件回顶栏、触发按钮让位给常驻侧栏）。
 * 所以这里跑区间里的三档宽度（360 是最窄的真实机型，也是那张问题截图的现场），
 * 再在 768 上专门验一次"翻回去了"。
 *
 * 四条按本项目踩坑定下的写法：
 * 1. **动画只能量，不能等 class**：面板位移写在 `transform` 上，读一次
 *    `getBoundingClientRect().x` 拿到的是插值中间态（与 CSS 几何断言同一个道理），
 *    所以用 rAF 连续采样（见 `clickAndSample`）：断言"起点在屏幕外 + 终点贴左缘 +
 *    中间有若干过渡值"，这才堵得住"一瞬间跳出来"的假绿；
 * 2. **采样与点击必须在同一个页面任务里发起**：`page.evaluate` 会一路跑到 resolve，
 *    Playwright 排在它后面的 `click` 因此一直没执行 —— 先起循环再点，采到的就是空数组
 *    （实测 readings.length === 0）。点击改为在 evaluate 内按 pointer/mouse 序列派发
 *    （与单测口径一致），真实可点性由本文件另外几条 `locator.click()` 覆盖；
 * 3. **判层级用 `elementFromPoint`**：`toBeVisible()` 对压在下层的元素照样放行
 *    （元素存在、有尺寸、visibility 正常），只有命中测试能暴露 z 序；
 * 4. **默认形态是 `vertical`**：品牌位在侧栏那一列，顶栏左侧给面包屑（蓝图 `headerLead`）。
 *    所以窄屏下"Logo 有没有画出来"要问抽屉那一列，顶栏带 Logo 的形态另外切一次再看。
 */

/** 窄屏档要跑的宽度（都 < 768，含最窄的 360） */
const NARROW_WIDTHS = [360, 390, 767];

/** 视口高度全程用同一个值，悬浮簇的垂直居中判据要靠它 */
const VIEWPORT_HEIGHT = 720;

/** 产品名（`apps/web` 传给外壳的 `title`） */
const APP_TITLE = 'Antdv Admin';

/** 侧栏触发按钮：窄屏下唯一的菜单入口（常驻侧栏在场时它不出现） */
function trigger(page: Page) {
  return page.locator('[data-layout-sidebar-trigger="true"]');
}

function panel(page: Page) {
  return page.locator('[data-layout-overlay-panel]');
}

function floating(page: Page) {
  return page.locator('[data-layout-floating-widgets]');
}

/**
 * 顶栏槽位里渲染出来的小部件。
 *
 * 不能数 `[data-layout-region="header"] button`：窄屏那一簇是 `fixed`，
 * 但 DOM 上仍是工具区的后代，两颗会被一起数进来（实测 360px 下读到 5 而不是 3）。
 */
function headerWidgets(page: Page) {
  return page.locator('[data-layout-region="header"] [data-layout-widget]');
}

/** 主题切换那颗按钮：文案跟着当前明暗换，两种都认 */
function themeButton(scope: Locator | Page) {
  return scope.locator(
    'button[aria-label="切换到深色"], button[aria-label="切换到浅色"]',
  );
}

/** 偏好抽屉的关闭入口（自绘 ×，按 Esc 关不掉，见 utils/app.ts 的同名 helper） */
async function closeDrawer(page: Page) {
  const drawer = page.locator('.setting-drawer');
  await drawer.getByRole('button', { exact: true, name: '关闭' }).click();
  await expect(drawer).toBeHidden();
}

/**
 * 派发一次点击，并用 rAF 连续采样浮层几何 `duration` 毫秒。
 *
 * 读的是**计算几何**而不是 class：`translateX(-100%)` 落到视口坐标就是 `x = -面板宽`，
 * 遮罩淡入是 `opacity` 的计算值 —— 这两条量的正是"蓝图里的一个数变成看得见的变化"那半程。
 */
function clickAndSample(page: Page, selector: string, duration: number) {
  return page.evaluate(
    ({ ms, target }) => {
      const source = document.querySelector(target);
      if (!source) throw new Error(`找不到触发元素：${target}`);
      for (const type of [
        'pointerdown',
        'mousedown',
        'pointerup',
        'mouseup',
        'click',
      ]) {
        source.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true }),
        );
      }

      return new Promise<{ maskOpacity: number[]; panelX: number[] }>(
        (resolveSample) => {
          const samples: { maskOpacity: number[]; panelX: number[] } = {
            maskOpacity: [],
            panelX: [],
          };
          const start = performance.now();
          const tick = () => {
            const drawer = document.querySelector(
              '[data-layout-overlay-panel]',
            );
            const shade = document.querySelector('[data-layout-overlay-mask]');
            // 两层都在场才记一次：收起结束后它们会被摘掉
            if (drawer && shade) {
              samples.panelX.push(drawer.getBoundingClientRect().x);
              samples.maskOpacity.push(
                Number.parseFloat(getComputedStyle(shade).opacity),
              );
            }
            if (performance.now() - start < ms) requestAnimationFrame(tick);
            else resolveSample(samples);
          };
          requestAnimationFrame(tick);
        },
      );
    },
    { ms: duration, target: selector },
  );
}

test.describe('窄屏导航栏', () => {
  test('三档窄屏逐个核对：菜单入口、顶栏收口、右缘悬浮簇、不溢出', async ({
    page,
  }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 360 });
    await signIn(page);
    // 小部件是异步 chunk：先等它们真挂出来，否则数量与几何都会读到"还没渲染"
    await expect(floating(page).locator('button')).toHaveCount(2);

    for (const width of NARROW_WIDTHS) {
      await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });
      const label = `视口 ${width}px`;
      // 换档要等一帧：窄屏判定走 matchMedia，收起/展开那一列随之重排
      await page.waitForTimeout(250);

      // 常驻侧栏让位，顶栏那颗按钮才是菜单入口
      await expect(region(page, 'sidebar'), label).toHaveCount(0);
      await expect(trigger(page), label).toBeVisible();
      await expect(trigger(page), label).toHaveAccessibleName('展开菜单');

      // 窄屏顶栏槽位只留「退出登录」；头像下拉不参与收口（位置与交互不变）
      await expect(headerWidgets(page), label).toHaveCount(1);
      await expect(
        headerWidgets(page).locator('[data-testid="logout-widget"]'),
        label,
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="header-user"]'),
        label,
      ).toBeVisible();

      // 右缘居中的悬浮簇：设置抽屉入口 + 主题切换
      await expect(
        floating(page).locator('button[aria-label="偏好设置"]'),
        label,
      ).toBeVisible();
      await expect(themeButton(floating(page)), label).toBeVisible();
      const box = await floating(page).boundingBox();
      expect(box, label).not.toBeNull();
      if (box) {
        // 贴右缘（`right-0`）、垂直居中（`top-1/2 -translate-y-1/2`）
        expect(Math.abs(box.x + box.width - width), label).toBeLessThanOrEqual(
          1,
        );
        expect(
          Math.abs(box.y + box.height / 2 - VIEWPORT_HEIGHT / 2),
          label,
        ).toBeLessThanOrEqual(2);
      }

      // 整页不出现横向溢出（那张截图上的标签页溢出，就是这条断言）
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${label} 出现横向溢出`).toBeLessThanOrEqual(1);
    }
  });

  test('抽屉那一列的品牌位画得出来：Logo 图 + 产品名', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 390 });
    await signIn(page);
    await trigger(page).click();
    await expect(panel(page)).toBeInViewport();

    const brand = panel(page).locator('[data-layout-logo="sidebar"]');
    await expect(brand).toBeVisible();
    // 产品名跟着进抽屉：以前只有图标栏补了 title，窄屏那一列只剩一张图
    await expect(brand).toContainText(APP_TITLE);

    const logo = brand.locator('img');
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 方图不被压扁：h-7 w-7 = 28×28，容 1px 取整
      expect(box.width).toBeGreaterThanOrEqual(27);
      expect(box.height).toBeGreaterThanOrEqual(27);
    }
    // 真的解码成功（不是 src 坏了的空 <img>）
    await expect
      .poll(() => logo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    // 抽屉宽度不超视口
    const panelBox = await panel(page).boundingBox();
    expect(panelBox?.width).toBeLessThanOrEqual(390);
  });

  test('顶栏带 Logo 的形态在窄屏也画得出品牌图', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 390 });
    await signIn(page);
    await setLayout(page, 'side-nav');

    const brand = region(page, 'header').locator('[data-layout-logo="header"]');
    const logo = brand.locator('img');
    await expect(logo, '窄屏下顶栏品牌位整块消失').toBeVisible();
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(27);
      expect(box.height).toBeGreaterThanOrEqual(27);
    }
    // 产品名在 `sm`(640px) 以下让位，那点宽度要给触发按钮和用户区。
    // 判可见性而不是判文本：`hidden sm:inline` 是 `display: none`，文字仍在 DOM 里。
    await expect(brand.locator('span')).toBeHidden();
    // 过 640 就回来（仍是窄屏档，只是品牌名不再挤）
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 700 });
    await expect(brand.locator('span')).toBeVisible();
    await expect(brand).toContainText(APP_TITLE);
  });

  test('点触发按钮滑出抽屉、遮罩淡入；点遮罩滑出去', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 390 });
    await signIn(page);
    await expect(floating(page).locator('button')).toHaveCount(2);

    const opening = await clickAndSample(
      page,
      '[data-layout-sidebar-trigger="true"]',
      700,
    );
    expect(opening.panelX.length, 'rAF 一次都没采到').toBeGreaterThan(3);
    const start = Math.min(...opening.panelX);
    const end = opening.panelX.at(-1) ?? 0;
    // 起点在屏幕外（translateX(-100%)，面板约 210px 宽），终点贴左缘
    expect(start, '面板没有从屏幕外滑入').toBeLessThan(-100);
    expect(Math.abs(end), '面板没停稳在左缘').toBeLessThanOrEqual(1);
    // 中间确有过渡值：只有首末两个位置说明是瞬移
    expect(
      opening.panelX.filter((x) => x < -1 && x > -100).length,
      '面板直接跳到位，没有滑入过程',
    ).toBeGreaterThan(1);
    // 遮罩同步淡入到完全不透明
    expect(Math.max(...opening.maskOpacity)).toBeGreaterThan(0.9);

    await expect(panel(page)).toBeInViewport();
    await expect(panel(page).locator('[data-menu-key]').first()).toBeVisible();

    // 悬浮簇压在遮罩之下：抽屉开着时点右缘那一簇不该命中它自己（z-30 < 遮罩 z-40）
    const cluster = await floating(page).boundingBox();
    expect(cluster).not.toBeNull();
    if (cluster) {
      const covered = await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-layout-overlay-mask]') !== null,
        { x: cluster.x + cluster.width / 2, y: cluster.y + cluster.height / 2 },
      );
      expect(covered, '悬浮簇浮在抽屉之上，把菜单盖住了').toBe(true);
    }

    // 收起：点遮罩，面板要滑出去而不是原地消失
    const leaving = await clickAndSample(
      page,
      '[data-layout-overlay-mask]',
      600,
    );
    expect(Math.min(...leaving.panelX), '收起时没有滑出过程').toBeLessThan(-1);
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeVisible();
  });

  test('按 Esc 收起，换页也自动收起', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 360 });
    await signIn(page);

    await trigger(page).click();
    await expect(panel(page)).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    // 抽屉开着时落到别的路由：手机上"点完菜单还压着内容区"是最难受的
    await trigger(page).click();
    await expect(panel(page)).toBeInViewport();
    await navigate(page, '/system/user');
    await expect(panel(page)).toHaveCount(0);
    await expect(region(page, 'sidebar')).toHaveCount(0);
  });

  test('右缘悬浮簇真能打开偏好抽屉，面板收得进 360px 视口', async ({
    page,
  }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 360 });
    await signIn(page);
    await expect(floating(page).locator('button')).toHaveCount(2);

    await floating(page).locator('button[aria-label="偏好设置"]').click();
    const drawer = page.locator('.setting-drawer');
    await expect(drawer).toHaveAttribute('data-state', 'open');

    // Sheet 进场动画还在跑时读到的是"半张面板在屏幕外"，量几何之前先等静止
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return box ? Math.round(box.x + box.width) : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(360);

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 视口 360：宽 = max(280, min(380, 360-24)) = 336，整张必须落在视口里
      expect(box.width).toBeGreaterThanOrEqual(280);
      expect(box.width).toBeLessThanOrEqual(360);
      expect(box.x).toBeGreaterThanOrEqual(0);
    }
    await closeDrawer(page);

    // 主题切换那颗也在簇里，点它要真的换明暗（不是个摆设）
    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    await themeButton(floating(page)).first().click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains('dark'),
        ),
      )
      .not.toBe(before);
  });

  test('头像下拉的位置与交互不受窄屏收口影响', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 390 });
    await signIn(page);

    const user = page.locator('[data-testid="header-user"]');
    await expect(user).toBeVisible();
    const box = await user.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 仍在顶栏右侧那一组里：贴右、垂直位置没跑到别处
      expect(box.y).toBeLessThan(60);
      expect(box.x + box.width).toBeGreaterThan(390 - 130);
    }

    await user.click();
    const item = page.locator('[data-testid="user-menu-profile"]');
    await expect(item).toBeVisible();
    // 菜单不甩到视口外（reka 的 popper 锚点错位就是这种表现）
    const itemBox = await item.boundingBox();
    expect(itemBox).not.toBeNull();
    if (itemBox) {
      expect(itemBox.x).toBeGreaterThanOrEqual(0);
      expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(390);
      expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(VIEWPORT_HEIGHT);
    }
    await page.keyboard.press('Escape');
  });

  test('768px 起回到桌面档：悬浮簇消失，小部件全部回顶栏', async ({ page }) => {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 768 });
    await signIn(page);
    // 簇里没按钮 == 整簇不渲染（异步 chunk 落地后再判，免得读到一个虚假的 0）
    await expect(
      region(page, 'header').locator('button[aria-label="偏好设置"]'),
    ).toBeVisible();

    await expect(floating(page)).toHaveCount(0);
    await expect(trigger(page)).toHaveCount(0);
    await expect(region(page, 'sidebar')).toBeVisible();
    // 偏好入口回到顶栏槽位，退出登录也在
    await expect(
      headerWidgets(page).locator('button[aria-label="偏好设置"]'),
    ).toBeVisible();
    await expect(
      headerWidgets(page).locator('[data-testid="logout-widget"]'),
    ).toBeVisible();
    // 桌面档槽位不止一颗（窄屏那条收口规则随之解除）
    expect(await headerWidgets(page).count()).toBeGreaterThan(1);
    // 窄屏档的内边距不带进桌面档：md 档实际算出 24px
    const padding = await region(page, 'header').evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).paddingLeft),
    );
    expect(padding).toBe(24);
  });

  test('窄屏全程没有本站脚本报错与接口失败', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: 360 });
    await signIn(page);
    await expect(floating(page).locator('button')).toHaveCount(2);

    await trigger(page).click();
    await expect(panel(page)).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await floating(page).locator('button[aria-label="偏好设置"]').click();
    await closeDrawer(page);
    await page.waitForTimeout(500);

    errors.stop();
    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });
});
