import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  go,
  openPreferenceDrawer,
  signIn,
  watchErrors,
} from './utils/app';

/**
 * 首屏 Loading 遮罩的主题色。
 *
 * 原缺陷：遮罩的颜色由插件在**构建期**扫一次 CSS 得到，用户后来在偏好里换了主色、
 * 切了深色，磁盘上的产物颜色不会跟着变 —— 于是站点全局是橙的、首屏那几百毫秒还是出厂蓝。
 * 现在插件往 `<head>` 注入一段自包含脚本，在应用代码之前把偏好写下的主题快照回填到
 * `<html>`，遮罩与外壳从第一帧起就是用户保存的那套颜色。
 *
 * 所以这里读的不是 class 名，而是**遮罩自己算出来的像素色**，并且只认应用挂载之前的
 * 那次读数（`#app` 还没有子节点）—— 挂载之后再量，应用的样式链路早就接管了，
 * 证不了"首屏就对了"。
 */

const DEFAULT_BLUE = 'rgb(22, 119, 255)';
/** 橙黄预设（`shared/constants/theme-presets.ts` 里的 #fa541c） */
const ORANGE = 'rgb(250, 84, 28)';
/** 插件注入的同步脚本标记（`internal/vite-config` 的 THEME_SYNC_MARKER） */
const THEME_SYNC_MARKER = 'data-app-loading-theme-sync';

interface BootSnapshot {
  mode: 'dark' | 'light';
  theme: 'auto' | 'dark' | 'light';
  themeKey: string;
  vars: { background: string; foreground: string; primary: string };
  /** 快照格式版本：v2 起颜色存 HSL 三段，v1 存的是完整颜色 */
  version: number;
}

/** 偏好包写下的首屏快照（明文，键名带应用前缀，按后缀找） */
function readSnapshot(page: Page): Promise<BootSnapshot | null> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.endsWith('_bootTheme'),
    );
    return key
      ? (JSON.parse(localStorage.getItem(key) as string) as BootSnapshot)
      : null;
  });
}

/**
 * 在应用挂载之前抢读一次遮罩与 `<html>`。
 *
 * `waitUntil: 'commit'` 之后文档还在解析，所以元素可能还不存在；
 * `booted` 用来丢弃挂载之后的读数 —— 那时量到的颜色是应用给的，不是脚本给的。
 */
function readFirstPaint(page: Page) {
  return page.evaluate(() => {
    const loader = document.querySelector('.app-loading__loader');
    if (!loader) return null;
    const root = document.documentElement;
    return {
      accent: getComputedStyle(loader, '::after').backgroundColor,
      appPrimaryInline: root.style.getPropertyValue('--primary'),
      booted: (document.querySelector('#app')?.childElementCount ?? 0) > 0,
      dark: root.classList.contains('dark'),
      dataTheme: root.dataset.theme,
      loadingPrimary: root.style.getPropertyValue('--loading-primary'),
    };
  });
}

/** 抢到那次"应用挂载之前"的读数 */
type FirstPaint = NonNullable<Awaited<ReturnType<typeof readFirstPaint>>>;

async function firstPaint(page: Page): Promise<FirstPaint> {
  let captured: FirstPaint | null = null;
  await expect
    .poll(
      async () => {
        const reading = await readFirstPaint(page);
        if (reading && !reading.booted && !captured) captured = reading;
        return captured;
      },
      { message: '没能在应用挂载前读到遮罩的颜色' },
    )
    .not.toBeNull();
  // 类型看不出闭包里的赋值，用一次显式判空把"轮询已保证非空"还给编译器
  const beforeBoot: FirstPaint | null = captured;
  if (!beforeBoot) throw new Error('轮询结束时没有抓到挂载前的读数');
  return beforeBoot;
}

async function pickAppearance(page: Page, ...labels: string[]) {
  await openPreferenceDrawer(page, '外观');
  for (const label of labels) {
    await page
      .getByRole('button', { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(200);
  }
  await closePreferenceDrawer(page);
}

test.describe('首屏 Loading 的主题色同步', () => {
  test('换预设主色后刷新，遮罩在应用挂载前就是新颜色', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await pickAppearance(page, '橙黄色');

    await expect
      .poll(() => readSnapshot(page).then((s) => s?.themeKey), {
        message: '偏好没有把新的主题快照落盘',
      })
      .toBe('orange');

    await page.reload({ waitUntil: 'commit' });
    const paint = await firstPaint(page);

    // 反证：默认档就是 antd 蓝，改完必须离开它
    expect(paint.accent, '遮罩方块还是出厂蓝').not.toBe(DEFAULT_BLUE);
    expect(paint.accent).toBe(ORANGE);
    expect(paint.dataTheme).toBe('orange');
    // 预设档不内联主色（暗色下另有提亮的一版），实色走遮罩专用变量
    expect(paint.appPrimaryInline).toBe('');
    expect(paint.loadingPrimary).not.toBe('');
  });

  test('深色偏好同样落在首屏', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await pickAppearance(page, '深色');

    await expect
      .poll(() => readSnapshot(page).then((s) => s?.mode), {
        message: '快照里没记下深色',
      })
      .toBe('dark');

    await page.reload({ waitUntil: 'commit' });
    const paint = await firstPaint(page);
    expect(paint.dark, '首屏脚本没把 dark class 提前写上').toBe(true);

    // 遮罩底色跟着走：深色档不该是白底
    const background = await page.evaluate(() => {
      const overlay = document.querySelector('.app-loading');
      return overlay ? getComputedStyle(overlay).backgroundColor : null;
    });
    if (background) expect(background).not.toBe('rgb(255, 255, 255)');
  });

  test('取色器的自定义色内联在 html 上，预设档才交给色板', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    await openPreferenceDrawer(page, '外观');
    await page.getByRole('button', { name: '自定义', exact: true }).click();
    await page.locator('input[type="color"]').fill('#123456');
    await closePreferenceDrawer(page);

    await expect
      .poll(() => readSnapshot(page).then((s) => s?.themeKey), {
        message: '自定义色没被记成 custom 档',
      })
      .toBe('custom');

    const snapshot = await readSnapshot(page);
    await page.reload({ waitUntil: 'commit' });
    const paint = await firstPaint(page);

    expect(paint.dataTheme).toBe('custom');
    /*
     * 取色器存下来的不是十六进制而是 `rgb()` 串（`toRgbString`），所以这里不能拿
     * 当初填的 `#123456` 比 —— 比的是"脚本内联的那条"等于"快照里记的那条"。
     */
    expect(paint.appPrimaryInline.trim()).not.toBe('');
    expect(paint.appPrimaryInline.trim()).toBe(snapshot?.vars.primary.trim());
  });

  /**
   * 把快照退回 v1 的形状：没有版本号，颜色存的是整色而不是 HSL 三段。
   *
   * 真实场景是"升级前存下的缓存"—— 格式换了但键名没换，读侧只能靠 `version` 认。
   */
  async function downgradeSnapshot(page: Page) {
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((name) =>
        name.endsWith('_bootTheme'),
      );
      if (!key) throw new Error('前置没成立：本地没有首屏快照');
      const snapshot = JSON.parse(localStorage.getItem(key) as string);
      snapshot.version = 1;
      snapshot.vars = {
        background: '#ffffff',
        foreground: '#000000',
        primary: 'rgb(18, 52, 86)',
      };
      localStorage.setItem(key, JSON.stringify(snapshot));
    });
  }

  test('旧格式快照只复原明暗与档位，颜色不参与首屏染色', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    await openPreferenceDrawer(page, '外观');
    await page.getByRole('button', { name: '自定义', exact: true }).click();
    await page.locator('input[type="color"]').fill('#123456');
    await closePreferenceDrawer(page);

    await expect
      .poll(() => readSnapshot(page).then((s) => s?.themeKey), {
        message: '自定义色没被记成 custom 档',
      })
      .toBe('custom');

    await downgradeSnapshot(page);
    await page.reload({ waitUntil: 'commit' });
    const paint = await firstPaint(page);

    // 与格式无关的三条照旧复原
    expect(paint.dataTheme).toBe('custom');
    /*
     *  gated 在版本号上的两条：把 v1 的整色写进 `--primary` / `--loading-primary`
     *  会让 `hsl(var(--loading-primary, …))` 整条失效，遮罩直接变透明 —— 比"没同步"更糟。
     */
    expect(paint.appPrimaryInline, 'v1 的整色被搬进了 html').toBe('');
    expect(paint.loadingPrimary, 'v1 的整色被搬进了首屏变量').toBe('');
  });

  test('没有快照时首屏退回兜底色，应用照常起来', async ({ page }) => {
    const errors = watchErrors(page);

    await page.goto('/#/login');
    // 抹掉快照，模拟"老用户的首访 / 手动清了这条缓存"
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.endsWith('_bootTheme')) localStorage.removeItem(key);
      }
    });
    await page.reload({ waitUntil: 'commit' });

    const paint = await firstPaint(page);
    expect(paint.accent, '没有快照时遮罩应该落在兜底蓝').toBe(DEFAULT_BLUE);

    // 同步脚本本身是静默的：读不到快照就 return，不抛错、不挡挂载
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
    const html = await page.content();
    const injections = html.split(THEME_SYNC_MARKER).length - 1;
    expect(injections, '同步脚本被重复注入').toBe(1);
    expect(errors.errors, errors.errors.join('\n')).toEqual([]);
    errors.stop();
  });
});
