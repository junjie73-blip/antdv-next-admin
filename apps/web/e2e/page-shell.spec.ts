import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, painted, setPreference, signIn } from './utils/app';

/**
 * 后台页面外壳（页头 / 分节 / 底色）的端到端口径。
 *
 * 这轮改版式不是"把某一页做好看"，而是给全站立一套共享骨架：
 * `PageHeader`（标题 + 说明 + 右侧主操作）、`Card` 的分节标题栏（次要操作靠右且降为描边）、
 * `PageToolbar`（筛选靠左、操作靠右，由 `BasicTable` 的工具栏那一行复用），
 * 内容区底色从写死的 `bg-gray-50 dark:bg-gray-900` 换成 `--muted` token。
 * 挑 `/system/user` 当样板页，是因为它几样都用上了，而且原来最难看：
 * 三颗实心主色按钮并排、筛选与操作混在一行、页面直接以卡片开头。
 *
 * 断言一律用计算样式与稳定 `data-*` 钩子，不抓 class 片段 ——
 * 工具类是 Tailwind 的实现细节，改个断点就把用例点红没有意义。
 */

/** 内容区（`bg-muted` 落在这一层 `<main>` 上） */
function canvas(page: Page): Locator {
  return page.locator('[data-layout-region="content"]');
}

/**
 * 页面本体：一律从内容区往下找。
 *
 * 「个人中心」这类抽屉是 force-mount 的，关掉后 DOM 还在（见仓库记忆），
 * 里面也挂着 `[data-slot="card"]` —— 直接按全页数卡片会把抽屉里的算进来，
 * 首/末元素根本不是这页的左树与右表。
 */
function view(page: Page): Locator {
  return canvas(page).locator('[data-page-view]');
}

/** 页内第 n 张卡片（0 = 部门树，1 = 用户列表） */
function card(page: Page, index: number): Locator {
  return view(page).locator('[data-slot="card"]').nth(index);
}

/** 元素的实际背景色 */
function backgroundOf(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).backgroundColor);
}

/** 当前主题档位算出来的 `--muted` 实色 */
function mutedPainted(page: Page) {
  return painted(page, 'hsl(var(--muted))');
}

/** 「天空蓝」预设：它的 `--muted` 带色相，能证明底色真的来自 token */
const SKY_BLUE = '#1890ff';

test.describe('后台页面外壳', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await expect(view(page).locator('[data-page="header"]')).toBeVisible();
  });

  test('页头给出标题、说明与右侧主操作，主操作是实心主色', async ({ page }) => {
    const header = view(page).locator('[data-page="header"]');
    await expect(header.locator('[data-page="header-title"]')).toContainText(
      '用户管理',
    );
    // 说明不是装饰：没有这行，页头就退化成一个孤零零的大标题
    await expect(header.locator('[data-page="header-desc"]')).not.toHaveText(
      '',
    );
    await expect(header.locator('[data-page="header-icon"]')).toBeVisible();

    const primary = header.locator('[data-page="header-extra"] button').first();
    await expect(primary).toContainText('新增用户');
    // 主操作要真的"实心"：背景色等于当前预设主色，跟着主题走
    await backgroundOf(primary).then(async (value) => {
      expect(value).toBe(await painted(page, 'hsl(var(--primary))'));
    });
  });

  test('次要操作降为描边，并收在分节标题栏右侧', async ({ page }) => {
    const cardHeader = card(page, 1).locator('[data-slot="card-header"]');
    await expect(cardHeader).toContainText('用户列表');
    const exportButton = cardHeader.getByRole('button', { name: /导出/ });
    await expect(exportButton).toBeVisible();
    await expect(
      cardHeader.getByRole('button', { name: /打印/ }),
    ).toBeVisible();

    /*
     * 层级要能被机器读懂：主操作 = 主色实心，次要操作 = 卡片底色 + 描边。
     * （不是"背景透明"—— shadcn 的 outline 档写的是 `bg-background`，
     *   透明反而会让它透出画布色，跟卡片不是一个面。）
     */
    const [secondary, primaryColor, cardColor] = await Promise.all([
      exportButton.evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          background: css.backgroundColor,
          borderWidth: Number.parseFloat(css.borderTopWidth),
        };
      }),
      painted(page, 'hsl(var(--primary))'),
      backgroundOf(card(page, 1)),
    ]);
    expect(secondary.borderWidth).toBeGreaterThan(0);
    expect(secondary.background).not.toBe(primaryColor);
    expect(secondary.background).toBe(cardColor);
  });

  /**
   * 底色 token 化的守门人。
   *
   * 写死 `bg-gray-50 dark:bg-gray-900` 时这条必红：算出来的颜色跟 `--muted` 永远对不上，
   * 换预设也不动。换成 token 后，浅色、换预设、深色三档都跟着走。
   */
  test('内容区底色取自 --muted，换主题预设与明暗都会跟过去', async ({
    page,
  }) => {
    const lightDefault = await backgroundOf(canvas(page));
    expect(lightDefault).toBe(await mutedPainted(page));

    await setPreference(page, { primaryColor: SKY_BLUE });
    await expect
      .poll(() => backgroundOf(canvas(page)), { message: '底色没跟着预设变' })
      .not.toBe(lightDefault);
    expect(await backgroundOf(canvas(page))).toBe(await mutedPainted(page));

    await setPreference(page, { theme: 'dark' });
    await expect
      .poll(() => backgroundOf(canvas(page)), { message: '深色下底色没跟上' })
      .not.toBe(lightDefault);
    expect(await backgroundOf(canvas(page))).toBe(await mutedPainted(page));
    // 卡片仍要比画布亮/暗一档，否则"分节"看不出来
    expect(await backgroundOf(card(page, 0))).not.toBe(
      await mutedPainted(page),
    );
  });

  test('窄屏把左树右表改成上下堆叠，页面不横向溢出', async ({ page }) => {
    /** 两张卡片是否并排成两栏（否则就是堆叠成单列） */
    const sideBySide = async () => {
      const tree = await card(page, 0).boundingBox();
      const table = await card(page, 1).boundingBox();
      return Boolean(tree && table && table.x > tree.x + tree.width - 2);
    };
    /** 两张卡片是否上下堆叠 */
    const stacked = async () => {
      const tree = await card(page, 0).boundingBox();
      const table = await card(page, 1).boundingBox();
      return Boolean(tree && table && table.y > tree.y + tree.height - 2);
    };

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(sideBySide, { message: '宽屏没有并排成两栏' }).toBe(true);

    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(stacked, { message: '窄屏没有堆叠成单列' }).toBe(true);

    // 单列下不许出现横向溢出：溢出的是表格自己的滚动口，不是页面
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  /**
   * 打印区域。改版式前页面上有两张卡片，而 `handlePrint` 写死
   * `[data-slot="card-content"]` —— 命中的是第一张，纸上印的是部门树。
   */
  test('打印目标只命中用户列表那一块', async ({ page }) => {
    const targets = card(page, 1).locator('[data-slot="card-content"]');
    await expect(
      page.locator('[data-print="user-table"] [data-slot="card-content"]'),
    ).toHaveCount(1);
    await expect(targets.locator('table')).toBeVisible();
    // 这一页有两处 card-content：说明"只写选择器不收窄"确实会挑错
    await expect(view(page).locator('[data-slot="card-content"]')).toHaveCount(
      2,
    );
  });

  /**
   * 外壳组件自己不带内边距与下边距，竖向节奏只由页面根容器的 `gap` 给一次。
   * 这条钉住"间距叠两层"不会从共享组件里漏回来（组件侧另有 page-shell 单测）。
   */
  test('页头不带 padding/margin，间距只来自页面根容器', async ({ page }) => {
    const box = await view(page)
      .locator('[data-page="header"]')
      .evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          marginBottom: Number.parseFloat(css.marginBottom),
          marginTop: Number.parseFloat(css.marginTop),
          paddingLeft: Number.parseFloat(css.paddingLeft),
          paddingTop: Number.parseFloat(css.paddingTop),
        };
      });
    expect(box).toEqual({
      marginBottom: 0,
      marginTop: 0,
      paddingLeft: 0,
      paddingTop: 0,
    });
  });
});

/**
 * 外壳约定的全站巡检。
 *
 * 单页断言只能保证样板页不塌；这轮把 17 个页面都换成了同一套骨架，
 * 需要一条"每页都走一遍"的口径，否则下一次加页面照样会漏，
 * 而且漏了没人知道 —— 版式退化是静默的，不会报错。
 *
 * 巡检只问三件机器判得准、且必须在真实 DOM 里才判得准的事：
 * 1. 页头三件套齐不齐（标题 + 说明），且页面根节点挂了 `data-page-view`；
 * 2. 页内只有一个 `<h1>`：写死标题的那类页面会在 PageHeader 之外再顶一个大标题；
 * 3. 内容区底色始终等于算出来的 `--muted`。
 *
 * 中性色是否走 token 不在这里查。DOM 上看到的是**渲染出来的整棵子树**，
 * 共享组件自带的工具类会一起被算进来 —— shadcn 的 destructive 按钮本身写着
 * `text-white dark:bg-destructive/60`，于是 17 页里凡是放了这个按钮的都"违规"。
 * 判"这页源码有没有写死灰阶"要看源码，归 `views/__tests__/page-shell-convention.spec.ts`。
 *
 * **刻意不管分类色**：分析面板的 KPI 图标底、微前端的加载方式标签这类"给同类事物分个颜色"
 * 的调色板（blue/violet/emerald/…）保留原样。它们不是状态语义，换成 4 个状态色反而把区分度抹平了；
 * 而且各自带了配对的 `dark:` 档，深浅色都不会糊。预设只负责主色，这部分不跟是已知且可接受的取舍。
 */
const SHELL_ROUTES = [
  '/system/user',
  '/system/role',
  '/system/menu',
  '/system/dept',
  '/system/post',
  '/system/notice',
  '/system/online',
  '/system/file',
  '/system/dict',
  '/system/settings',
  '/system/log',
  '/system/login-log',
  '/system/micro-app',
  '/security/dashboard',
  '/account/center',
  '/account/settings',
  '/dashboard/analysis',
];

test.describe('外壳约定全站巡检', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const route of SHELL_ROUTES) {
    test(`${route} 齐备：页头 / 单一 h1 / 底色走 token`, async ({ page }) => {
      await go(page, route);

      const root = view(page);
      await expect(root).toHaveCount(1);
      const header = root.locator('[data-page="header"]');
      await expect(header).toBeVisible();
      await expect(header.locator('[data-page="header-title"]')).not.toHaveText(
        '',
      );
      await expect(header.locator('[data-page="header-desc"]')).not.toHaveText(
        '',
      );
      await expect(root.locator('h1')).toHaveCount(1);

      // 底色这条是全站口径：页面自己不该再铺一层背景
      expect(await backgroundOf(canvas(page))).toBe(await mutedPainted(page));
    });
  }
});

/**
 * 改版式时顺手抓到的一类缺陷：按钮看着能点，点了什么都不发生。
 *
 * 「个人中心」原来靠 `inject('switchAccountTab')` 跳转，而全站没有任何组件
 * `provide` 过这个 key —— 于是"前往修改"永远只是按一下亮一下。
 * 这类静默失效只有真点一下才发现，所以留成一条用例。
 */
test.describe('个人中心的跳转是真的', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await go(page, '/account/center');
  });

  test('页头主操作跳到账户设置', async ({ page }) => {
    await view(page)
      .locator('[data-page="header-extra"] button')
      .first()
      .click();
    await expect(page).toHaveURL(/#\/account\/settings/);
    await expect(
      view(page).locator('[data-page="header-title"]'),
    ).toContainText('账户设置');
  });

  test('安全设置页签里的「前往修改」也真的跳', async ({ page }) => {
    await view(page).getByText('安全设置').click();
    await view(page).getByRole('button', { name: '前往修改' }).click();
    await expect(page).toHaveURL(/#\/account\/settings/);
  });
});
