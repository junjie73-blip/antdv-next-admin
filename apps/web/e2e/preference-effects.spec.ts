import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  cssVar,
  go,
  openPreferenceDrawer,
  painted,
  region,
  settingControl,
  signIn,
  watchErrors,
} from './utils/app';

/**
 * 偏好项**落到 DOM 上**的效果，以及 toast 两条通道的层级/位置/配色。
 *
 * `preferences.spec.ts` 验的是抽屉这层 UI（能不能滚到、控件点得动），
 * `layout.spec.ts` 改偏好是直接写 pinia；这两条路径都不检查
 * "蓝图里的一个数字，最后变成界面上看得见的变化"这半程 ——
 * 而圆角、字号、顶栏反转色、通知位置这四个缺陷恰好都出在这半程上：
 * 换算写成百分比还是 px、变量名是不是样式表读的那个、偏好键有没有落进 CSS 变量。
 * 所以这里全程真点抽屉里的控件，断言读的是**计算样式**而不是 class 名。
 */

/** 轻提示那只 toaster：位置固定"顶部 + 水平居中"（top-center） */
function messageToaster(page: Page) {
  return page.locator(
    'ol[data-sonner-toaster][data-x-position="center"][data-y-position="top"]',
  );
}

/** 按出场位置取通知那只 toaster */
function notificationToaster(page: Page, x: string, y: string) {
  return page.locator(
    `ol[data-sonner-toaster][data-x-position="${x}"][data-y-position="${y}"]`,
  );
}

/** 按类型取轻提示那一条（可再按文案收窄，避开上一条还没散去的同类提示） */
function toast(page: Page, type: string, hasText?: string) {
  const base = page.locator(`li[data-sonner-toast][data-type="${type}"]`);
  return (hasText ? base.filter({ hasText }) : base).first();
}

/**
 * 等到屏幕上一条提示都不剩。
 *
 * 登录本身就发一条 success，而 sonner 是按 index 叠着排、并把最新一条插在最前；
 * 不清干净的话，"居中"量到的是叠放偏移后的位置，同类文案也会撞出多个命中。
 */
async function clearToasts(page: Page) {
  await expect
    .poll(() => page.locator('li[data-sonner-toast]').count(), { timeout: 12_000 })
    .toBe(0);
}

/** 等一条提示的入场动画彻底停下（slide-in 期间量到的是位移中的旧位置） */
async function settleToast(target: Locator) {
  await target.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => null),
  );
}

/** 把一条提示当前的几何与配色一次性读回来 */
function readToast(target: Locator) {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const centerX = Math.round(box.left + box.width / 2);
    const centerY = Math.round(box.top + box.height / 2);
    const hit = document.elementFromPoint(centerX, centerY);
    return {
      background: cs.backgroundColor,
      border: cs.borderTopColor,
      centerX,
      centerY,
      /** 命中测试：中心点上真正接住点击的是不是这条 toast 自己 */
      hitSelf: !!(hit && hit.closest('li[data-sonner-toast]') === el),
      text: cs.color,
    };
  });
}

test.describe('偏好项的实际生效', () => {
  test('圆角大小：倍率换算成 px，并接到组件的 border-radius 上', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    const drawer = await openPreferenceDrawer(page, '外观');
    /**
     * 圆角那一档是 5 个纯按钮（`0 / 0.25 / 0.5 / 0.75 / 1`），
     * 抽屉里只有它一处用 `grid-cols-5`，比按按钮文字找稳。
     */
    const tiles = drawer.locator('.grid.grid-cols-5 > button');

    // 默认倍率 1 × 基准 8px
    await expect
      .poll(() => cssVar(page, '--app-border-radius'))
      .toBe('8px');

    await tiles.nth(2).click(); // 0.5
    await expect
      .poll(() => cssVar(page, '--app-border-radius'))
      .toBe('4px');
    await tiles.nth(0).click(); // 0
    await expect
      .poll(() => cssVar(page, '--app-border-radius'))
      .toBe('0px');

    /*
     * 变量写了不等于界面变了：`--app-border-radius` 要真的被
     * `--radius-lg` 读走、`rounded-lg` 再读 `--radius-lg`，链路断在任何一环
     * 表现都是"设置里点了没反应"。用一枚探针量到最终像素值。
     */
    const radius = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'rounded-lg';
      document.body.append(probe);
      const value = getComputedStyle(probe).borderRadius;
      probe.remove();
      return value;
    });
    expect(radius, '倍率 0 时 rounded-lg 应当没有圆角').toBe('0px');

    await tiles.nth(4).click(); // 恢复 1
    await expect
      .poll(() => cssVar(page, '--app-border-radius'))
      .toBe('8px');

    await closePreferenceDrawer(page);
    expect(errors.errors).toEqual([]);
  });

  test('字体大小：写的是根字号百分比，缩放整条 rem 链路', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    const drawer = await openPreferenceDrawer(page, '外观');

    // 默认 14 → 14/14 = 100% → 跟浏览器默认一致
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('16px');

    const sizeField = settingControl(drawer, '字体大小');
    await sizeField.fill('16');
    await sizeField.press('Tab'); // 失焦才提交（NumberField 的编辑态）

    /*
     * 16 / 14 = 114.29% 的根字号 → 16px × 1.1429 ≈ 18.29px。
     * 根字号是整条 rem 链路的锚点（`html { font-size: var(--app-font-size) }`），
     * 它一动页面里所有 em/rem 尺寸跟着缩放 —— 量到的 18px 级就是
     * 「设置里改一个数字，全站真的变大」的证据。
     * 换算写成 px 的话根字号只会变成 16px（看不出效果），写成固定 em 又不会缩放全局。
     */
    const root = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(root).toBeGreaterThan(18);
    expect(root).toBeLessThan(18.6);

    await sizeField.fill('14');
    await sizeField.press('Tab');
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
      )
      .toBe('16px');

    await closePreferenceDrawer(page);
    expect(errors.errors).toEqual([]);
  });

  test('顶栏反转色：只把顶栏整条换成深色，侧栏与内容区不动', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);

    const header = region(page, 'header');
    const readHeader = () =>
      header.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          background: cs.backgroundColor,
          /** 深色档就是 `headerClass()` 里 `bg-gray-800` 那一支，类名是稳定实值 */
          darkTone: el.className.includes('bg-gray-800'),
          text: cs.color,
        };
      });

    const before = await readHeader();
    expect(before.darkTone, '浅色主题且开关关着时不该是深色顶栏').toBe(false);

    const drawer = await openPreferenceDrawer(page, '外观');
    const toggle = settingControl(drawer, '顶栏反转色');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    /*
     * 「生效」的判据是这一行整体换到深色档：底色变深、文字翻亮。
     * 不钉 `rgb(...)` 的实值 —— gray-800 属于 Tailwind 调色板而不是设计令牌，
     * 版本一升级色值口径就变（v4 起算成 oklab），而缺陷本身是"开关翻了没反应"，
     * 类名 + 底色变化 + 文字反差三条一起兜，比记一个魔法数字稳。
     */
    const after = await readHeader();
    expect(after.darkTone, '开关翻起来后顶栏应当走深色档').toBe(true);
    expect(after.background, '顶栏底色必须跟着开关走').not.toBe(before.background);
    expect(after.text, '深底要配亮字，否则顶栏文字直接看不见').not.toBe(
      before.text,
    );

    // 反转色是"顶栏这一条"的属性，不该把侧栏一起拖黑
    const siderBackground = await page.evaluate(() => {
      const sider = document.querySelector('[data-layout-region="sidebar"]');
      return sider ? getComputedStyle(sider).backgroundColor : '';
    });
    expect(siderBackground, '侧栏不该跟着顶栏一起变深').not.toBe(after.background);

    await toggle.click();
    await expect
      .poll(() => header.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(before.background);

    await closePreferenceDrawer(page);
    expect(errors.errors).toEqual([]);
  });
});

test.describe('轻提示通道', () => {
  test('层级压过外壳、出场在顶部居中、四种类型各有各的规范色', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/cron');
    await clearToasts(page);
    await clearToasts(page);

    const toaster = messageToaster(page);
    await expect(toaster).toHaveCount(1);

    /*
     * 原缺陷：提示弹出来却被顶栏压住，看着像"没提示"。
     * 外壳里最大的实值层级是 9999（路由进度条 / 锁屏），
     * 所以判据是"浮层的层级严格高于它"，而不是钉某个魔法数字。
     */
    const z = await toaster.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).zIndex),
    );
    expect(z, 'toaster 的层级要盖过外壳里最大的实值 9999').toBeGreaterThan(9999);

    // 1. success：点「预设表达式」卡片里的预设按钮
    const presetCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText('预设表达式', { exact: true }) });
    /*
     * 每张卡片里还嵌着一个 CronEditor，它自己的「常用预设」也有颗「每分钟」，
     * 而组件内部不弹提示 —— 只有卡片上方那排演示按钮会调 `message.success`。
     * 演示行在模板里排在编辑器之前，取 first 就是它。
     */
    await presetCard
      .getByRole('button', { name: '每分钟', exact: true })
      .first()
      .click();
    const success = toast(page, 'success', '已应用');
    await expect(success).toBeVisible();
    await settleToast(success);

    const box = await success.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && viewport) {
      /**
       * 轻提示按全局规范落在**顶部居中**：`top-center` 把 toast 上沿贴在默认
       * `--offset-top`（24px）处。判据是"上沿靠近视口顶部、且明显在上半区"，
       * 而不是钉死 24px（不同主题/字号会有几像素出入）。同样要先 `settleToast`
       * 等入场 slide-in（translateY -100%→0）停下再量，否则量到的是位移中途。
       */
      expect(box.y, '轻提示应当贴近视口顶部').toBeLessThan(80);
      expect(box.y + box.height, '轻提示不该落到视口中线以下').toBeLessThan(
        viewport.height / 2,
      );
      expect(
        Math.abs(box.x + box.width / 2 - viewport.width / 2),
        '轻提示应当水平居中',
      ).toBeLessThan(10);
    }

    const first = await readToast(success);
    // 中心点上真正接住点击的就是它自己 → 没有被顶栏/任何浮层盖住
    expect(first.hitSelf, 'toast 中心应当命中自己，而不是被外壳挡住').toBe(true);
    expect(
      first.text,
      '富色开启时文字色就是令牌里的成功色',
    ).toBe(await painted(page, 'var(--app-success)'));

    // 2. info：点「重置」丢弃草稿
    await page.getByRole('button', { name: '重置', exact: true }).click();
    const infoTarget = toast(page, 'info', '已丢弃草稿');
    await expect(infoTarget).toBeVisible();
    const info = await readToast(infoTarget);
    expect(info.text).toBe(await painted(page, 'var(--app-info)'));
    expect(info.background, 'info 底色不该和 success 共用一块').not.toBe(
      first.background,
    );

    // 3. error：草稿填成非法表达式再点「应用」
    const draft = page.getByPlaceholder('手动输入 Cron 表达式，例如 0 30 4 * * *');
    await draft.fill('* * *');
    await page.getByRole('button', { name: '应用', exact: true }).click();
    const errorTarget = toast(page, 'error', '表达式无效');
    await expect(errorTarget).toBeVisible();
    const errorToast = await readToast(errorTarget);
    expect(errorToast.text).toBe(await painted(page, 'var(--app-destructive)'));
    expect(errorToast.background).not.toBe(first.background);
    expect(errorToast.background).not.toBe(info.background);

    /*
     * 富色的开关也得验：sonner 只在 `[data-rich-colors='true']` 下消费
     * `--{type}-{bg,border,text}`，关掉就退化成四块一模一样的白底。
     */
    await expect(success).toHaveAttribute('data-rich-colors', 'true');
    const plain = await painted(page, 'var(--app-popover)');
    expect(first.background, '底色不该还是默认白').not.toBe(plain);

    expect(errors.errors).toEqual([]);
  });

  test('warning 类型同样挂上规范色（账号设置：空密码提交）', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/account/settings');
    await clearToasts(page);

    await page.getByRole('button', { name: '更新密码', exact: true }).click();
    const warning = toast(page, 'warning');
    await expect(warning).toBeVisible();

    const read = await readToast(warning);
    expect(read.text).toBe(await painted(page, 'var(--app-warning)'));
    expect(read.hitSelf).toBe(true);
    expect(errors.errors).toEqual([]);
  });

  test('通知通道的位置由偏好决定，且不与轻提示串位', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);

    // 默认 bottomRight：一只居中靠上（轻提示）+ 一只右下（通知）
    await expect(messageToaster(page)).toHaveCount(1);
    await expect(notificationToaster(page, 'right', 'bottom')).toHaveCount(1);

    const drawer = await openPreferenceDrawer(page, '通用');
    /** 这一行的控件就是那条分段条（`SettingItem` 用 `data-setting-label` 认领键名） */
    const bar = settingControl(drawer, '通知位置');
    await bar
      .locator('[data-slot="toggle-group-item"][aria-label="左上"]')
      .click();

    await expect(notificationToaster(page, 'left', 'top')).toHaveCount(1);
    await expect(notificationToaster(page, 'right', 'bottom')).toHaveCount(0);
    /*
     * 两条通道各走各的位置：换了通知位置，轻提示那只仍得是 center/top。
     * 混在同一只 toaster 里时这条断言必红（sonner 一只 toaster 只有一个堆栈）。
     */
    await expect(messageToaster(page)).toHaveCount(1);

    await bar
      .locator('[data-slot="toggle-group-item"][aria-label="右下"]')
      .click();
    await expect(notificationToaster(page, 'right', 'bottom')).toHaveCount(1);

    await closePreferenceDrawer(page);
    expect(errors.errors).toEqual([]);
  });
});
