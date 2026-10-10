import type { Locator } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  expectActivePath,
  expectTabBar,
  go,
  openPreferenceDrawer,
  region,
  setLayout,
  settingControl,
  signIn,
  tab,
  watchErrors,
} from './utils/app';

/**
 * 布局形态与横向导航溢出。
 *
 * `@antdv/layouts` 把 7 种形态收敛成一张区域蓝图表（`LAYOUT_BLUEPRINTS`），
 * 外壳只按开关渲染。这张表写错、或者装配层漏接一个 `v-if`，单测看不出来
 * ——所以这里按表逐项对账：每种形态该有几根导航柱，DOM 里就得有几根。
 * 期望值的依据标在每行注释里，改 `packages/layouts/src/modes.ts` 时这里会一起红。
 */

interface Regions {
  /**
   * 面包屑出现的次数。
   * 蓝图里 `headerLead` 决定它住顶栏还是内容列第一行，两种住法都算 1；
   * `chromeless`（内容全屏）才是 0。
   */
  breadcrumb: number;
  headerNav: number;
  navRail: number;
  /** 侧栏常驻时为 1；无侧栏、内容全屏都为 0 */
  sidebar: number;
  /** 标签栏是否渲染 */
  tabs: boolean;
}

const CASES: Array<[string, Regions]> = [
  // sidebarSource: 'tree'，一棵完整树常驻；headerLead 'breadcrumb' 让 Logo 让位
  ['vertical', { breadcrumb: 1, headerNav: 0, navRail: 0, sidebar: 1, tabs: true }],
  // navRailVisible + sidebarSource 'active-top'，顶栏leading 也是面包屑
  ['two-column', { breadcrumb: 1, headerNav: 0, navRail: 1, sidebar: 1, tabs: true }],
  // headerNavVisible + sidebarSource 'none'：面包屑退到内容列第一行
  ['horizontal', { breadcrumb: 1, headerNav: 1, navRail: 0, sidebar: 0, tabs: true }],
  /*
   * 侧边导航：曾经的缺陷是蓝图写了 `sidebarPresentation: 'drawer'`，
   * 桌面端选了它之后菜单躲进默认收起的浮层里，看起来"什么都没出现"。
   * 修好后这一列必须常驻（sidebar 1）。
   */
  ['side-nav', { breadcrumb: 1, headerNav: 0, navRail: 0, sidebar: 1, tabs: true }],
  // headerNavDepth 1 + sidebarSource 'active-top'：两级同时在
  ['mixed-vertical', { breadcrumb: 1, headerNav: 1, navRail: 0, sidebar: 1, tabs: true }],
  // headerNav + rail(二级) + sidebar(三级)：mock 菜单只到二级，第三列必空 → 空列让位
  ['mixed-two-column', { breadcrumb: 1, headerNav: 1, navRail: 1, sidebar: 0, tabs: true }],
  // chromeless：外壳全隐，标签栏也折叠
  ['full-content', { breadcrumb: 0, headerNav: 0, navRail: 0, sidebar: 0, tabs: false }],
];

test.describe('布局形态', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const [mode, expected] of CASES) {
    test(`${mode}：区域开关与蓝图一致`, async ({ page }) => {
      const errors = watchErrors(page);
      /**
       * 先落到二级菜单页再切形态：面包屑默认开了"仅一级时隐藏"，
       * 虽然修好数据源之后首页也是两级（见下面"首次进入页面"那条用例），
       * 但二级页在每个形态下的格子数最稳定，用它对账不受首页归属变化的影响。
       */
      await go(page, '/system/user');
      await setLayout(page, mode);

      await expect(region(page, 'header-nav')).toHaveCount(expected.headerNav);
      await expect(region(page, 'nav-rail')).toHaveCount(expected.navRail);
      await expect(region(page, 'sidebar')).toHaveCount(expected.sidebar);
      await expect(region(page, 'breadcrumb')).toHaveCount(expected.breadcrumb);
      await expect(page.locator('.tab-list')).toHaveCount(
        expected.tabs ? 1 : 0,
      );
      expect(errors.errors).toEqual([]);
    });
  }

  /**
   * Logo 位与顶栏那一行必须严格对齐。
   *
   * 这个需求看起来是"差 8px 的审美问题"，根子是 antd 的 cssinjs 注入
   * `.ant-layout-header{height:64px;line-height:64px}`：类选择器 + 后注入，
   * 特异性压过 Tailwind 的 `.h-14`，于是顶栏 64、侧栏 Logo 56，两栏顶端错开一条缝。
   * 现在三处 Logo（侧栏 / 图标栏 / 顶栏）与顶栏都吃同一个 `LAYOUT_HEADER_ROW_STYLE`，
   * 断言也就从"看起来对齐"升级成"盒子的实际渲染位置与高度相等"。
   *
   * 外壳里 Logo 与顶栏只有三种几何关系（由蓝图的 `headerLead` / 导航是否入流决定）：
   * - `column-top`：Logo 在左列、与顶栏并排（垂直 / 双列）—— 顶边 y 与高度都相等；
   * - `under-header`：顶栏横贯全宽，图标栏从下一行开始（混合双列）—— 只比高度，
   *   行与行之间还有 `gap-4` 的外壳留白，这是设计的一部分，不该当成错位；
   * - `inside-header`：Logo 就住在顶栏里（水平 / 侧边导航 / 混合）—— 盒子必须被顶栏包住。
   *
   * 三种形态都容 1px：flex 居中 + `line-height` 排版会产生半像素，
   * 拿精确相等去卡等于给渲染引擎挑刺，真正要防的是 56/64 这种量级的错位。
   */
  const LOGO_CASES: Array<{
    geometry: 'column-top' | 'inside-header' | 'under-header';
    logo: string;
    mode: string;
  }> = [
    {
      geometry: 'column-top',
      logo: '[data-layout-logo="sidebar"]',
      mode: 'vertical',
    },
    { geometry: 'column-top', logo: '[data-layout-logo="rail"]', mode: 'two-column' },
    {
      geometry: 'under-header',
      logo: '[data-layout-logo="rail"]',
      mode: 'mixed-two-column',
    },
    {
      geometry: 'inside-header',
      logo: '[data-layout-logo="header"]',
      mode: 'horizontal',
    },
    {
      geometry: 'inside-header',
      logo: '[data-layout-logo="header"]',
      mode: 'side-nav',
    },
    {
      geometry: 'inside-header',
      logo: '[data-layout-logo="header"]',
      mode: 'mixed-vertical',
    },
  ];

  /** 外壳行间距（`layoutClassName` 的 `gap-4`），混合形态下顶栏与下一行之间就有这一段 */
  const SHELL_GAP = 16;
  const TOL = 1;

  for (const { geometry, logo, mode } of LOGO_CASES) {
    test(`${mode}：Logo 位与顶栏同高对齐`, async ({ page }) => {
      await go(page, '/system/user');
      await setLayout(page, mode);

      const logoBox = page.locator(logo).first();
      const header = page.locator('[data-layout-region="header"]').first();
      await expect(logoBox).toBeVisible();
      await expect(header).toBeVisible();

      const [box, headerBox] = await Promise.all([
        logoBox.boundingBox(),
        header.boundingBox(),
      ]);
      expect(box, `${logo} 没有渲染出盒子`).not.toBeNull();
      expect(headerBox, '顶栏没有渲染出盒子').not.toBeNull();

      /**
       * 高度对齐是所有形态共有的不变量 —— 也是需求本身（"logo 区域的高度要和顶栏对齐"）。
       * 只断言"和顶栏相等"时，两处一起错回 64px 也算绿，所以把设计值 56 一起钉住。
       * 用 ±1 的区间而不是 `toBe`：顶栏可能带 1px 下边框，Logo 行是纯 56。
       */
      expect(box!.height, 'Logo 行高必须停在设计值 56').toBeGreaterThanOrEqual(
        56 - TOL,
      );
      expect(box!.height, 'Logo 行高必须停在设计值 56').toBeLessThanOrEqual(
        56 + TOL,
      );
      expect(
        Math.abs(box!.height - headerBox!.height),
        `Logo 行高 ${box!.height} 与顶栏 ${headerBox!.height} 对不齐`,
      ).toBeLessThanOrEqual(TOL);

      if (geometry === 'column-top') {
        expect(
          Math.abs(box!.y - headerBox!.y),
          '左列 Logo 与顶栏不在同一水平线上',
        ).toBeLessThanOrEqual(TOL);
      } else if (geometry === 'under-header') {
        const gap = box!.y - (headerBox!.y + headerBox!.height);
        expect(gap, '图标栏的 Logo 应紧接顶栏下一行').toBeGreaterThanOrEqual(-TOL);
        expect(gap, `Logo 掉到顶栏下 ${gap}px，超出外壳留白`).toBeLessThanOrEqual(
          SHELL_GAP + TOL,
        );
      } else {
        expect(box!.y, 'Logo 顶出顶栏了').toBeGreaterThanOrEqual(
          headerBox!.y - TOL,
        );
        expect(
          box!.y + box!.height,
          'Logo 底出顶栏了',
        ).toBeLessThanOrEqual(headerBox!.y + headerBox!.height + TOL);
      }
    });
  }

  test('side-nav：侧栏里的菜单树真的有条目，且能展开跳转', async ({ page }) => {
    await setLayout(page, 'side-nav');
    const sidebar = region(page, 'sidebar');

    /*
     * 原缺陷：菜单其实"渲染了"，只是渲染在一个默认收起的浮层抽屉里，
     * 桌面用户看到的就是选完什么都没发生。所以这里既要有条目、也要在常驻列里。
     */
    await expect(sidebar.locator('.ant-menu-submenu').first()).toBeVisible();
    await expect(
      page.locator('.ant-drawer [data-layout-region="sidebar"]'),
      '侧栏不该躲在抽屉浮层里',
    ).toHaveCount(0);

    await sidebar
      .locator('.ant-menu-submenu-title')
      .filter({ hasText: '系统管理' })
      .click();
    const leaf = sidebar
      .locator('.ant-menu-title-content')
      .filter({ hasText: '用户管理' })
      .first();
    await expect(leaf).toBeVisible();
    await leaf.click();
    /**
     * 20s 而不是默认的 10s：侧边菜单点下去之后要等 `/system/user` 的异步块就位，
     * dev 下这个页面第一次访问还得现场编译。WebKit 冷跑（刚切完布局、外壳整棵重渲染）
     * 实测会超过 10s —— 报出来是"标签页不存在"，看着像菜单点不动，实际再等几秒就好。
     * 只放宽这一处等待，前面的可见性断言与点击本身都还是原口径。
     */
    await expectActivePath(page, '/system/user', 20_000);
  });

  test('混合布局：一级横向与二级侧边同时存在且都有条目', async ({ page }) => {
    await setLayout(page, 'mixed-vertical');
    await go(page, '/system/user');

    const headerItems = region(page, 'header-nav').locator(
      '.ant-menu-item, .ant-menu-submenu',
    );
    const sideItems = region(page, 'sidebar').locator('.ant-menu-item');

    // 原缺陷的回归保护：曾经"点了菜单，两级导航都是空的"，
    // 根因是后端菜单写相对片段，横向/侧边一起落到 404
    await expect(headerItems.first()).toBeVisible();
    await expect(sideItems.first()).toBeVisible();
    expect(await headerItems.count()).toBeGreaterThan(0);
    expect(await sideItems.count()).toBeGreaterThan(0);
  });

  test('混合布局：切换一级导航后侧边栏跟着换', async ({ page }) => {
    await setLayout(page, 'mixed-vertical');
    await go(page, '/system/user');
    await expect(region(page, 'sidebar').getByText('用户管理')).toBeVisible();

    await go(page, '/dashboard/workbench');
    await expect(region(page, 'sidebar').getByText('工作台')).toBeVisible();
    await expect(region(page, 'sidebar').getByText('用户管理')).toHaveCount(0);
  });

  /**
   * 导航精简后新增的不变量（菜单只剩仪表盘 / 系统管理三项 / 组件示例 / 微前端）。
   *
   * 「部门管理」这类页面被标成 `hidden`，语义是不在导航里出现，而不是没权限：
   * 直达仍能进、标签页仍有正常标题、一级归属仍算「系统管理」。
   * 早先按"删菜单项"实现时，这三条会分别变成 403、路径当标题、侧栏跳回仪表盘。
   */
  test('隐藏页：导航里查无此项，直达却能用', async ({ page }) => {
    await setLayout(page, 'mixed-vertical');

    const sidebar = region(page, 'sidebar');
    await go(page, '/system/user');
    await expect(sidebar.getByText('部门管理')).toHaveCount(0);

    await go(page, '/system/dept');
    // 一级高亮仍归「系统管理」，而不是退回第一项
    await expect(
      region(page, 'header-nav').locator('.ant-menu-submenu-selected, .ant-menu-item-selected'),
    ).toContainText('系统管理');
    // 标签页拿到的是菜单标题而不是路径
    await expect(tab(page, '/system/dept')).toHaveText(/部门管理/);
  });

  test('内容全屏收起标签栏，换回常驻形态后恢复', async ({ page }) => {
    await setLayout(page, 'full-content');
    await expect(page.locator('.tab-list')).toHaveCount(0);

    await setLayout(page, 'vertical');
    await expect(page.locator('.tab-list')).toHaveCount(1);
  });
});

/**
 * 面包屑的"冷启动"时机。
 *
 * 用户报的是"第一次进入页面，面包屑不会自动加载上去"，两个时机都算第一次：
 * 登录后直接落到的首页，以及在任何页面上按刷新。
 *
 * 根因不在渲染分支，而在数据源：链原先取自 `route.matched` 的 `meta.title`，
 * 而文件约定路由只给**叶子**声明了 meta，父级布局记录没有标题 → 链被砍成一格，
 * 再撞上"仅一级时隐藏"这条默认偏好，整条面包屑就消失了 —— 看着像"没加载出来"。
 * 现在链优先取自菜单树（菜单里有几级就画几级），`matched` 只在菜单查不到时兜底。
 */
test.describe('面包屑 · 首次进入', () => {
  test('登录落地的首页就画出完整链', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);

    /**
     * 一次跳转都没有：`signIn` 之后停在登录成功跳转的目标页（仪表盘下的分析面板）。
     * 这正是缺陷发生的那个时机，所以这里连 `go()` 都不能用。
     */
    await expect(region(page, 'breadcrumb')).toHaveCount(1);
    await expect(
      region(page, 'breadcrumb').locator('.ant-breadcrumb-item'),
    ).toHaveText(['仪表盘', '分析面板']);
    expect(errors.errors).toEqual([]);
  });

  test('刷新后仍然画出完整链（菜单是异步下发的，不能等第二次导航）', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/basic');

    /**
     * 刷新**之前**先把这一跳坐实：断言链已经画全 + `networkidle` 确认没有在飞的请求。
     *
     * 不等的话 `page.reload()` 会和页面自己的懒加载模块抢时间 —— dev 下第一次进
     * `/components/basic` 要现场编译它和它牵出来的依赖（实测被掐断的是
     * `@antdv/composables` 里 SSE 重连那个 chunk），Firefox 把这一下报成
     * `pageerror: error loading dynamically imported module`，用例就被自己的时序判红。
     * 这条用例要验的是"刷新之后菜单还在不在"，不是"刷新时恰好有谁在飞"。
     */
    await expect(
      region(page, 'breadcrumb').locator('.ant-breadcrumb-item'),
    ).toHaveText(['组件示例', '组件画廊', '基础组件', '通用']);
    await page.waitForLoadState('networkidle');

    await page.reload();
    await expectTabBar(page);

    // 三级页：菜单树到位后链应该是完整四级，而不是被 matched 砍成一级
    await expect(
      region(page, 'breadcrumb').locator('.ant-breadcrumb-item'),
    ).toHaveText(['组件示例', '组件画廊', '基础组件', '通用']);
    expect(errors.errors).toEqual([]);
  });
});

/**
 * 面包屑。
 *
 * 原缺陷是"设置里明明开了面包屑，顶栏却什么都不显示"：
 * 渲染分支只有一条 `headerLead === 'breadcrumb'` 的路径（垂直 / 双列），
 * 其余形态的顶栏被 Logo 与横向菜单占着，`showBreadcrumb` 这个偏好就没有归宿。
 * 现在蓝图把两种"住法"都安排上了：顶栏leading 的形态住顶栏，其余住内容列第一行。
 */
test.describe('面包屑', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    // 二级页：面包屑链稳定有两格，"仅一级时隐藏"这条默认偏好不会把断言变成运气测试
    await go(page, '/system/user');
  });

  test('垂直形态：面包屑住在顶栏里，标题跟着当前页走', async ({ page }) => {
    await setLayout(page, 'vertical');

    // 住在顶栏内部，而不是内容区上方另起一行
    await expect(
      page.locator(
        '[data-layout-region="header"] [data-layout-region="breadcrumb"]',
      ),
    ).toHaveCount(1);
    await expect(region(page, 'breadcrumb')).toContainText('用户管理');
  });

  /**
   * 每一级的链接必须指向自己那一页。
   *
   * 缺陷藏在 antd 的 `items[].path` 语义里：它的注释原话是
   * "It will concat all prev `path` to the current one"，实现是
   * `href = '#/' + paths.join('/')`。我们的菜单 path 本来就是完整路径，
   * 于是"系统管理 / 用户管理"被画成 `#/system` 与 `#/system/system/user` ——
   * 中键点击、右键"在新标签页打开"、状态栏预览指向一个不存在的地址，
   * 看起来就是"面包屑点不动 / 点了 404"。改成传 `href`（`router.resolve` 生成）后，
   * 这里既核对 href，也真点一次父级，确认不会落到那个拼出来的假地址。
   */
  test('每一级的链接指向自己那一页', async ({ page }) => {
    await setLayout(page, 'vertical');

    const trail = region(page, 'breadcrumb').locator('.ant-breadcrumb-item');
    await expect(trail).toHaveCount(2);
    await expect(trail.nth(0).locator('a')).toHaveAttribute('href', '#/system');
    await expect(trail.nth(1).locator('a')).toHaveAttribute(
      'href',
      '#/system/user',
    );

    await trail.nth(0).locator('a').click();
    /**
     * 目录节点点下去由守卫落到它下面的第一个叶子，具体落点不是这条用例的重点；
     * 重点是别掉进 `#/system/system/user` 那种拼出来的假地址。
     */
    await expect(page, '点击面包屑跳到了拼错的地址').not.toHaveURL(
      /\/system\/system\//,
    );
    await expect(region(page, 'breadcrumb')).toHaveCount(1);
  });

  /**
   * 面包屑的图标就是菜单里那个图标（用户报的"两边对不上"）。
   *
   * 图标名不在 DOM 里（`@iconify/vue` 直接渲染裸 svg），所以比"字形本身"：
   * 同一个图标名渲染出的 `svg.innerHTML` 是同一串 path。按标题把两边配对再逐项比，
   * 等于把"菜单数据是唯一真相"钉死 —— 渲染侧原先给根节点兜底画了座房子，
   * 菜单画的是 dashboard，按标题配对立刻对不上。
   */
  test('每一级的图标和菜单里同一项完全一致', async ({ page }) => {
    await setLayout(page, 'vertical');

    const pairs = await page.evaluate(() => {
      /** 图标的"字形指纹"：svg 内部标记；没有图标就是 null */
      const glyph = (el: Element | null | undefined): null | string =>
        el?.querySelector('svg')?.innerHTML ?? null;

      const crumbs = [...document.querySelectorAll(
        '[data-layout-region="breadcrumb"] .ant-breadcrumb-item',
      )].map((el) => ({
        glyph: glyph(el),
        title: (el.textContent ?? '').trim(),
      }));

      const menu = [
        ...document.querySelectorAll(
          '[data-layout-region="sidebar"] .ant-menu-submenu-title, [data-layout-region="sidebar"] .ant-menu-item',
        ),
      ].map((el) => ({
        glyph: glyph(el),
        title: (
          el.querySelector('.ant-menu-title-content')?.textContent ?? ''
        ).trim(),
      }));

      return crumbs.map((crumb) => ({
        crumb,
        menu: menu.find((m) => m.title === crumb.title) ?? null,
      }));
    });

    expect(pairs.length, '面包屑应至少画出一级').toBeGreaterThan(0);
    for (const { crumb, menu } of pairs) {
      expect(menu, `菜单里找不到面包屑的「${crumb.title}」`).not.toBeNull();
      expect(
        crumb.glyph,
        `「${crumb.title}」面包屑图标与菜单图标不是同一个字形`,
      ).toBe(menu!.glyph);
    }
    // 有图标时才谈"对得上"；两边全空说明图标集没加载，这条用例就失去意义了
    expect(
      pairs.some(({ crumb }) => crumb.glyph !== null),
      '当前环境没有渲染出任何图标，这条用例无从判断',
    ).toBe(true);
  });

  test('Logo 系形态：面包屑落到内容列第一行，不跟横向菜单抢顶栏', async ({ page }) => {
    for (const mode of ['horizontal', 'side-nav', 'mixed-vertical']) {
      await setLayout(page, mode);
      await expect(
        region(page, 'breadcrumb'),
        `${mode} 下面包屑应当出现`,
      ).toHaveCount(1);
      await expect(
        page.locator(
          '[data-layout-region="header"] [data-layout-region="breadcrumb"]',
        ),
        `${mode} 下面包屑不该挤进顶栏`,
      ).toHaveCount(0);
    }
  });

  test('面包屑图标开关：关掉后每一级只剩文字', async ({ page }) => {
    /**
     * `showBreadcrumbIcon` 这个偏好此前在渲染层被完全忽略（开关点了没反应）。
     * 图标节点没有稳定文案可查，所以量结构：带图标时每级是「图标 + 文字」两个子节点。
     */
    await setLayout(page, 'vertical');

    const iconStats = () =>
      region(page, 'breadcrumb').evaluate((el) => ({
        items: el.querySelectorAll('.ant-breadcrumb-item').length,
        // 只数条目里的 svg：分隔符（chevron）挂在 .ant-breadcrumb-separator 上，不算图标
        withIcon: el.querySelectorAll('.ant-breadcrumb-item svg').length,
      }));

    const before = await iconStats();
    expect(before.items, '面包屑应至少渲染出一级').toBeGreaterThan(0);
    expect(before.withIcon, '默认显示图标时每级都该有一个图标').toBe(
      before.items,
    );

    const drawer = await openPreferenceDrawer(page, '布局');
    await settingControl(drawer, '显示面包屑图标').click();
    await closePreferenceDrawer(page);

    const after = await iconStats();
    expect(after.items).toBe(before.items);
    expect(after.withIcon, '关掉图标开关后应只剩文字').toBe(0);
  });

  test('抽屉里的开关真的能关掉它，再打开就回来', async ({ page }) => {
    await setLayout(page, 'vertical');
    await expect(region(page, 'breadcrumb')).toHaveCount(1);

    const drawer = await openPreferenceDrawer(page, '布局');
    await settingControl(drawer, '开启面包屑').click();
    await closePreferenceDrawer(page);
    await expect(region(page, 'breadcrumb')).toHaveCount(0);

    await openPreferenceDrawer(page, '布局');
    await settingControl(drawer, '开启面包屑').click();
    await closePreferenceDrawer(page);
    await expect(region(page, 'breadcrumb')).toHaveCount(1);
  });

  test('内容全屏形态下面包屑一起收起', async ({ page }) => {
    await setLayout(page, 'full-content');
    await expect(region(page, 'breadcrumb')).toHaveCount(0);
  });
});

/**
 * 侧栏收起态的设计宽度（`@antdv/layouts` 的 `LAYOUT_SIDEBAR_COLLAPSED_WIDTH`）。
 * 改那个 token 时这里会一起红 —— 正是想要的联动。
 */
const COLLAPSED_WIDTH = 64;

test.describe('侧边菜单样式', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'vertical');
  });

  /**
   * 同一层的菜单项，标题左边缘必须在同一条竖线上。
   *
   * 需求原话是"菜单的样式有点问题"，根因是没图标的项不占图标位：
   * antd 给图标元素 `.ant-menu-item-icon` 的 `min-width` 由 iconSize 决定，
   * 有图标的项文字就被这一格顶开，没图标的项贴在最左边，整列看着参差。
   * 现在 `buildMenuItems(..., { keepIconSlot: true })` 给缺图标的项补空槽，
   * 于是按"同层 x 坐标只有一个值"来验收 —— 比目测可靠，也不会被内联 padding 骗过去
   * （antd 的层级缩进是内联 `padding-left`，类选择器压不住，只有 `inlineIndent` 能改）。
   *
   * 分工说明：当前种子数据里每一项都有图标，这条 e2e 只能证明"改完没把齐的地方弄歪"；
   * "没图标的那一项到底有没有拿到等宽空槽"由
   * `apps/web/test/menu-icon-slot.test.ts` 直接挂 antd `Menu` 数 DOM 来验。
   */
  test('同层菜单项的文字左边缘对齐（缺图标也占位）', async ({ page }) => {
    await go(page, '/components/basic');

    const byDepth = await region(page, 'sidebar').evaluate((el) => {
      const groups = new Map<number, Set<number>>();
      for (const item of el.querySelectorAll('.ant-menu-item')) {
        // 层级 = 这项外面套了几层 `.ant-menu-sub`（antd 的子菜单容器）
        let depth = 0;
        let node: Element | null = item.parentElement;
        while (node && node !== el) {
          if (node.classList.contains('ant-menu-sub')) depth += 1;
          node = node.parentElement;
        }
        const title = item.querySelector('.ant-menu-title-content');
        if (!title) continue;
        const rect = title.getBoundingClientRect();
        /**
         * 不在布局里的项一律跳过：处于收起子树 / 测量副本里的元素
         * `getBoundingClientRect()` 全是 0，把 0 混进样本就成了"对不齐"的假红。
         */
        if (rect.width === 0) continue;
        if (!groups.has(depth)) groups.set(depth, new Set());
        groups.get(depth)!.add(Math.round(rect.x));
      }
      return [...groups].map(([depth, xs]) => ({ count: xs.size, depth, xs: [...xs] }));
    });

    // 深层页至少有"一级目录 + 二级子项"两层，否则这条断言是空跑
    expect(byDepth.length, '样本里至少要有两层菜单').toBeGreaterThanOrEqual(2);
    for (const { count, depth, xs } of byDepth) {
      // 只有一项的那层比不出什么，样本太少就单独说明
      if (count < 2) continue;
      expect(xs, `第 ${depth + 1} 层的文字左边缘对不齐：${xs.join(', ')}`).toHaveLength(
        1,
      );
    }
  });

  /**
   * 折叠入口挪到这一列的底边。
   *
   * 放在顶栏时，用户要点到屏幕右上角才能收起"左边这一列"，动作和目标隔着整个屏幕；
   * 顶栏那个入口在侧栏常驻的形态里就此让位（不再重复给按钮）。
   */
  test('折叠条在侧栏底部，点击真的收起/展开', async ({ page }) => {
    await go(page, '/system/user');

    const bar = page.locator('[data-layout-sidebar-collapse]');
    const sidebar = region(page, 'sidebar');
    await expect(bar).toHaveCount(1);
    // 在侧栏这一列里面，而不是飘在顶栏
    await expect(sidebar.locator('[data-layout-sidebar-collapse]')).toHaveCount(
      1,
    );

    const expandedWidth = await settledWidth(sidebar);
    await expect(bar).toHaveAttribute('aria-expanded', 'true');

    await bar.click();
    await expect(sidebar).toHaveClass(/ant-layout-sider-collapsed/);
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    await expect(bar).toHaveAttribute('aria-label', '展开菜单');
    // 收起后的宽度是设计 token（`LAYOUT_SIDEBAR_COLLAPSED_WIDTH`），只说"变窄了"太松
    expect(
      Math.abs((await settledWidth(sidebar)) - COLLAPSED_WIDTH),
      `收起后宽度应停在 ${COLLAPSED_WIDTH}`,
    ).toBeLessThanOrEqual(1);

    await bar.click();
    await expect(sidebar).not.toHaveClass(/ant-layout-sider-collapsed/);
    expect(
      Math.abs((await settledWidth(sidebar)) - expandedWidth),
      `展开后宽度没回到 ${expandedWidth}`,
    ).toBeLessThanOrEqual(1);
  });

  /**
   * 常驻形态下顶栏不该再放一个折叠按钮（两处按钮管同一个状态必然漂移），
   * 但浮层形态（窄屏抽屉）没有底边可放，顶栏入口必须还在。
   */
  test('常驻侧栏不给顶栏重复入口，窄屏抽屉里仍然有', async ({ page }) => {
    await go(page, '/system/user');
    await expect(
      page.locator('[data-layout-region="header"] [aria-label="收起菜单"]'),
      '侧栏常驻时顶栏不该再有折叠入口',
    ).toHaveCount(0);

    await page.setViewportSize({ height: 720, width: 640 });
    // 窄屏：外壳换成抽屉，侧栏不再常驻，顶栏入口回来负责开合
    await expect(region(page, 'sidebar')).toHaveCount(0);
    await expect(
      page.locator('[aria-label="展开菜单"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-layout-sidebar-collapse]')).toHaveCount(0);
  });
});

test.describe('横向导航溢出', () => {
  test('溢出时箭头、滚轮、拖拽都能访问到全部菜单项', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await setLayout(page, 'horizontal');
    // 收窄视口逼它溢出：菜单总宽超过可视区才会出现滚动条
    await page.setViewportSize({ height: 720, width: 720 });

    const scroller = page.locator('.header-menu-scroll');
    await expect(scroller).toBeVisible();
    const overflow = await scroller.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow, '窄视口下横向菜单应当溢出').toBeGreaterThan(0);

    /**
     * 三种滚动方式各自"归零 → 触发 → 断言真的滚出去了"，而不是串成一条链。
     *
     * 上一版是链式的（记住上一步的 scrollLeft，要求下一步更大），
     * 菜单精简成四类之后溢出总量只剩两三百像素：箭头和滚轮一步就顶到了上限，
     * 拖拽那步的基准已经等于最大值，断言"还要更大"就成了永远不可能成立的死条件。
     * 拆成独立场景既不会被总量限制，也更贴近各自要验证的东西。
     */
    const resetScroll = async () => {
      /**
       * `behavior: 'instant'` 不是多余的修饰：上一步是 smooth 滚动，
       * `scrolledPast` 只要看到 scrollLeft 大于基准就返回，此时动画还在飞。
       * 裸赋值会被那段动画继续推着走（Chromium 会把它跑到目标值），
       * 而 instant 滚动按规范会**取消**进行中的平滑滚动，状态才是真的干净。
       */
      await scroller.evaluate((el) => {
        el.scrollTo({ behavior: 'instant', left: 0 });
      });
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollLeft), {
          message: '等待横向滚动归零',
        })
        .toBe(0);
    };

    // 1) 右箭头（step=220，smooth 滚动 → 用 poll 等落地）
    await resetScroll();
    await page.getByRole('button', { name: '向右滚动菜单' }).click();
    await scrolledPast(scroller, 0);

    // 2) 纵向滚轮在可横向滚动时被接管
    await resetScroll();
    await scroller.hover();
    await page.mouse.wheel(0, 240);
    await scrolledPast(scroller, 0);

    // 3) 拖拽跟手（反向位移）
    await resetScroll();
    const box = await scroller.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    await scrolledPast(scroller, 0);

    // 4) 一路点到底，最后一项进入可视区（"能访问全部项"的字面意思）
    for (let i = 0; i < 10; i += 1) {
      const right = page.getByRole('button', { name: '向右滚动菜单' });
      if (!(await right.isVisible().catch(() => false))) break;
      await right.click();
      await page.waitForTimeout(120);
    }
    const lastReachable = await scroller.evaluate((el) => {
      /**
       * 菜单项不是滚动容器的直接子节点：中间还夹着 antd 的
       * `.ant-menu-overflow` 根节点，所以按类名取。
       * 另外本项目用 `[&_.ant-menu-overflow-item-rest]:hidden!` 关掉了 antd 的
       * "溢出折叠成 …" 行为（折叠了就没法横向访问了），那个占位项要排除；
       * `-hidden` 是 antd 的测量副本，同样不算。
       * 用 getBoundingClientRect 而不是 offsetLeft：后者的基准是 offsetParent，
       * 跨了绝对定位的渐隐层就容易对不上。
       */
      const items = [
        ...el.querySelectorAll<HTMLElement>(
          '.ant-menu-overflow-item:not(.ant-menu-overflow-item-rest):not(.ant-menu-overflow-item-hidden)',
        ),
      ];
      if (items.length === 0) return false;
      const container = el.getBoundingClientRect();
      const last = items[items.length - 1]!.getBoundingClientRect();
      return last.right <= container.right + 2;
    });
    expect(lastReachable).toBe(true);

    // 5) 左箭头出现并且能往回滚（一步 200px，不是直接回起点）
    const beforeLeft = await scroller.evaluate((el) => el.scrollLeft);
    await page.getByRole('button', { name: '向左滚动菜单' }).click();
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollLeft), {
        message: '等待向左滚动生效',
        timeout: 10_000,
      })
      .toBeLessThan(beforeLeft);

    expect(errors.errors).toEqual([]);
  });
});

test.describe('菜单 ↔ 标签页联动', () => {
  test('菜单依次跳转，标签逐个新增并跟随激活', async ({ page }) => {
    await signIn(page);
    for (const path of ['/system/user', '/system/role', '/system/menu']) {
      await go(page, path);
      await expect(tab(page, path)).toHaveAttribute('data-active', 'true');
    }
  });
});

/**
 * 等横向滚动生效。
 *
 * `scrollByStep` 用 `behavior: 'smooth'`，读一次瞬时值必然踩空，
 * 所以轮询"scrollLeft 是否已经超过某个基准"。
 */
async function scrolledPast(scroller: Locator, baseline: number) {
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollLeft), {
      message: `等待横向滚动超过 ${baseline}`,
      timeout: 10_000,
    })
    .toBeGreaterThan(baseline);
}

/**
 * 等侧栏宽度动画停住再读数。
 *
 * antd 的 `Sider` 宽度是 CSS 过渡（约 0.2s），点完立刻 `boundingBox()` 读到的是中间值：
 * 单独跑时机器快、恰好落在终点附近就绿，全量跑到那一条撞上动画就红 ——
 * 这种"看时机"的断言必须等稳。判据取"连续两次读数相同"，
 * 而不是补一个大延时（延时只是把赌注改大，不是取消赌局）。
 */
async function settledWidth(sidebar: Locator) {
  let previous = -1;
  await expect
    .poll(
      () =>
        sidebar
          .boundingBox()
          .then((box) => {
            const width = box?.width ?? -1;
            const stable = width > 0 && width === previous;
            previous = width;
            return stable;
          }),
      { message: '等待侧栏宽度动画停住', timeout: 5_000 },
    )
    .toBe(true);
  return previous;
}
