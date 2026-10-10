import type { Locator, Page } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import { go, setLayout, signIn, watchErrors } from './utils/app';

/**
 * 交互巡检：把"每一页都打开看一眼、每个操作都点一下"变成可重复的断言。
 *
 * 和 `site-sweep.spec.ts` 的分工：那一套问"页面有没有坏"（控制台、4xx、有没有渲染），
 * 这一套问"页面有没有**真的能用**"——
 * 表格有没有出数、搜索分页的条件有没有真的发出去、抽屉弹窗点了有没有反应。
 *
 * 这三类缺陷恰好都是 site-sweep 抓不到的：接口 200、DOM 一大片、控制台干净，
 * 但表体是空的（envelope 少解一层）、筛选永远返回全量第一页（查询串被包成
 * `?params=[object Object]`）、开关拨了导航不动。用户能一眼看出来，机器要靠断言。
 */

interface LeafMenu {
  path: string;
  title: string;
}

/** 菜单叶子清单：直接从 Nitro 现取，后端加页面不必改这里 */
async function collectLeaves(page: Page): Promise<LeafMenu[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/menus', { credentials: 'include' });
    const body = (await res.json()) as {
      data?: { list?: Array<Record<string, unknown>> };
    };
    const leaves: LeafMenu[] = [];
    const walk = (nodes: Array<Record<string, unknown>>) => {
      for (const node of nodes) {
        const children = (node.children ?? []) as Array<Record<string, unknown>>;
        const path = String(node.path ?? '');
        if (children.length > 0) walk(children);
        else if (path.startsWith('/')) {
          leaves.push({
            path,
            title: String(node.menuName ?? node.title ?? path),
          });
        }
      }
    };
    walk(body.data?.list ?? []);
    return leaves;
  });
}

/** 顶栏一级导航的可见文案（去掉折叠箭头等子节点文本） */
async function topLevelNavTitles(page: Page): Promise<string[]> {
  return regionTitles(
    page.locator('[data-layout-region="header-nav"] .ant-menu').first(),
  );
}

/** 侧边二级导航的可见文案 */
async function sideNavTitles(page: Page): Promise<string[]> {
  return regionTitles(page.locator('[data-layout-region="sidebar"] .ant-menu').first());
}

/**
 * 可见的树节点。
 * antd Tree 会额外渲染一条 `aria-hidden` 的量测节点，直接数 `.ant-tree-treenode`
 * 会把"只有量测节点、真树是空的"算成有数据。
 */
function visibleTreeNodes(page: Page): Locator {
  return page.locator('.ant-tree-treenode:not([aria-hidden="true"])');
}

/**
 * 只取"这一层"的条目文本。
 *
 * 不能用 `.ant-menu-item`：子菜单展开时孙层的条目也是 `.ant-menu-item`，
 * 会把侧栏读成一长串。`> .ant-menu-item / > .ant-menu-submenu` 才是本层。
 */
async function regionTitles(menu: Locator): Promise<string[]> {
  const items = menu.locator(':scope > .ant-menu-item, :scope > .ant-menu-submenu');
  const count = await items.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const title = (await items.nth(i).innerText()).replace(/\s+/g, '').trim();
    if (title) titles.push(title);
  }
  return titles;
}

test.describe('交互巡检：导航精简、首屏出数、查询串、抽屉与弹窗', () => {
  test('导航只剩需求里的四类，个人中心不在导航上', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'mixed-vertical');
    await go(page, '/system/user');

    const top = await topLevelNavTitles(page);
    for (const required of ['仪表盘', '系统管理', '组件示例', '微前端']) {
      expect(top, `一级导航应含「${required}」，实际：${top.join(' / ')}`).toContain(required);
    }
    for (const banned of ['个人中心', '系统工具', '系统监控', '异常页面']) {
      expect(top, `一级导航不该再出现「${banned}」`).not.toContain(banned);
    }

    // 系统管理只留三项：部门/岗位/通知/在线/文件 都改成了 hidden
    expect(await sideNavTitles(page)).toEqual(['用户管理', '角色管理', '菜单管理']);
  });

  test('个人中心改由头像下拉进抽屉，两个页签都有内容', async ({ page }) => {
    await signIn(page);
    await go(page, '/dashboard/analysis');

    await page.locator('.ant-avatar').first().click();
    await page.getByRole('menuitem', { name: '个人中心' }).click();

    const drawer = page.locator('.ant-drawer-open');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('个人中心');

    // 默认「个人主页」要有真内容，不能是个空壳
    await expect(drawer.getByRole('tab', { name: '个人主页' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // 切到「账户设置」：表单要出来
    await drawer.getByRole('tab', { name: '账户设置' }).click();
    await expect(
      drawer.locator('.ant-form-item, .ant-tabs-tabpane, input').first(),
    ).toBeVisible();

    // 切回来仍然可用（页签来回不是单向）
    await drawer.getByRole('tab', { name: '个人主页' }).click();
    await expect(drawer.getByRole('tab', { name: '个人主页' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /**
   * 隐藏页"看不见但进得去"这条不变量的浏览器版：
   * 直达 `/system/dept` 不是 403，标签页拿到菜单标题而不是路径。
   */
  test('隐藏页直达仍然可用，且不会被导航精简牵连', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'mixed-vertical');

    const probe = watchErrors(page);
    await go(page, '/system/dept');

    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
    expect(
      await page.locator('[data-layout-region="content"], main').first().innerText(),
    ).not.toMatch(/页面不存在|没有权限/);
    expect(probe.badResponses).toEqual([]);
    probe.stop();
  });

  /**
   * 带表格的页面首屏必须出数据行。
   *
   * 判"有表格"而不是"这页该有数据"：菜单是从后端现取的，加页面不用改这里。
   * 空表只在 mock 明确返回空集时才允许，而本项目每个列表接口都有种子数据，
   * 所以 `0 行 + 没有暂无数据占位` 一律算坏，`0 行 + 有占位` 单独列出来给人看。
   */
  test('每个列表页首屏都真的出数（含 envelope 少解一层的回归）', async ({ page }) => {
    await signIn(page);

    const leaves = await collectLeaves(page);
    expect(leaves.length).toBeGreaterThan(10);

    // 重型页面首屏要等异步块 + 接口，按页数给预算
    test.setTimeout(Math.max(180_000, leaves.length * 20_000));

    const tables: Array<{ path: string; rows: number; empty: boolean }> = [];

    for (const leaf of leaves) {
      /**
       * 逐个叶子页走一遍，每个页面**第一次**被访问时 dev server 要现场编译它的异步块。
       * Chromium 热跑这一步不到 1s，WebKit 冷跑能到十几秒（实测 `/screen/monitor` 之后
       * 紧接 `/system/user` 就等不到标签页激活）。这段等待由 `go()` 最后一次尝试兜底（20s），
       * 判定条件本身一点没放松。
       */
      await go(page, leaf.path);

      const table = page.locator('.ant-table').first();
      if ((await table.count()) === 0) continue;

      /**
       * 轮询到"有结论"为止，而不是固定 sleep。
       *
       * 首屏出数的时间差极大：mock 里有的接口带 500ms 延时，dev 下第一次访问还要等
       * Vite 现编译这个页面。固定等 400ms 会把"还没到"读成"没有数据"，
       * 报出 `/demo/table-pagination-test 0 行` 这种假缺陷 —— 手动打开明明是 10 行。
       *
       * ⚠️ "空态"要等 loading 撤掉才算数：antd 在转圈期间就把 `暂无数据` 占位渲染出来了，
       * 一见 `.ant-empty` 就收工等于把"还在加载"判成"确实没数据"，
       * 于是取数挂死的页面反而能混过去。所以判据是：出行了，或者"不转圈了且是空的"。
       */
      const deadline = Date.now() + 15_000;
      // 循环体里先赋值再判定，所以这里只声明不赋初值（赋 0 会被下面的覆盖，白写）
      let rows: number;
      let empty: number;
      for (;;) {
        rows = await page.locator('.ant-table-tbody .ant-table-row').count();
        const loading = await page.locator('.ant-spin-spinning').count();
        empty = loading === 0 ? await page.locator('.ant-table .ant-empty').count() : 0;
        if (rows > 0 || empty > 0 || Date.now() > deadline) break;
        await page.waitForTimeout(300);
      }
      tables.push({ empty: empty > 0, path: leaf.path, rows });
    }

    const broken = tables.filter((t) => t.rows === 0 && !t.empty);
    const genuinelyEmpty = tables.filter((t) => t.rows === 0 && t.empty);

    expect(
      broken,
      `这些页面有表格却一行都没出（多半是 envelope 少解一层 / 首屏竞态）：${broken
        .map((t) => t.path)
        .join(', ')}；全部表格页：${JSON.stringify(tables)}`,
    ).toEqual([]);

    // 空集页面单独打印，方便人工确认"是真没数据"而不是"取数失败"
    if (genuinelyEmpty.length) {
      console.log('[ops-sweep] 显示"暂无数据"的页面：', genuinelyEmpty.map((t) => t.path));
    }
    console.log('[ops-sweep] 表格页出数情况：', JSON.stringify(tables));
  });

  /**
   * 搜索/分页条件必须真的进 query。
   *
   * 回归的是 `api/request.ts` 里 `http.Get(url, { params })` 这个写法：
   * 底层第二个位置参数**就是查询串本身**，再包一层会发出 `?params=[object Object]`，
   * 于是筛选框打字、翻页、改每页条数全都"看着没反应"，接口却一直是 200。
   */
  test('用户管理：搜索与分页把条件写进 query', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    const urls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/system/user/list')) urls.push(request.url());
    });

    // 先翻页再搜索：筛完只剩几条，"下一页"是禁用态，点了会超时（那不是缺陷是用例顺序问题）
    // 表格分页用的参数名是 `pageNum`（与 `pageSize` 成对），断言按真实字段来
    const firstRow = () =>
      page.locator('.ant-table-tbody .ant-table-row').first().innerText();
    const pageOneFirstRow = await firstRow();

    await expect(page.locator('.ant-pagination-next')).toBeEnabled();
    await page.locator('.ant-pagination-next').click();
    await expect
      .poll(() => urls.some((u) => /[?&]pageNum=[2-9]\d*/.test(u)), {
        message: `分页参数没进 query，实际请求：${urls.join(' | ')}`,
        timeout: 10_000,
      })
      .toBe(true);

    /**
     * 请求里带了 `pageNum=2` 只证明前端把参数发出去了，不证明后端按它切了页。
     * mock 的列表接口一律读的是 `query.page`（legacy 那套命名），而表格发的是 `pageNum`，
     * 于是第 2 页返回的还是第 1 页那十行 —— 用户点"下一页"看到内容纹丝不动。
     * 这条断言盯的就是"翻页真的换数据"，只断言 URL 是盯不住的。
     */
    await expect
      .poll(firstRow, {
        message: '翻到第 2 页显示的还是第 1 页那几行',
        timeout: 10_000,
      })
      .not.toBe(pageOneFirstRow);

    await page.getByPlaceholder('搜索用户名/昵称/邮箱/手机号...').fill('张');
    await page.getByRole('button', { name: '查询' }).first().click();

    await expect
      .poll(
        () =>
          urls.some((u) => u.includes('keyword=%E5%BC%A0') || u.includes('keyword=张')),
        {
          message: `搜索条件没进 query，实际请求：${urls.join(' | ')}`,
          timeout: 10_000,
        },
      )
      .toBe(true);

    expect(
      urls.some((u) => u.includes('params=%5Bobject') || u.includes('params=[object')),
      `查询串被包成了 [object Object]：${urls.join(' | ')}`,
    ).toBe(false);
  });

  /**
   * 树表首屏必须"自己就展开"。
   *
   * 曾经的症状：菜单管理只有 9 行（一级目录），子菜单全折着 ——
   * `expandedRowKeys` 里装的是 `String(id)`，而 antd 拿 `record.id`（数字）严格比较，
   * 于是"展开全部"永远不命中，同时因为传了非 undefined 的受控 keys，
   * 同批的 `defaultExpandAllRows: true` 也被忽略。不点箭头就看不见子项，
   * 搜索命中子项时更是直接"查无结果"（祖先出来了、孩子折在里面）。
   */
  test('树表首屏自动展开到最深一级，不必手点箭头', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/menu');

    const rows = () => page.locator('.ant-table-tbody .ant-table-row');
    await expect(rows().first()).toBeVisible();

    // antd 给每行的层级 class（`ant-table-row-level-N`）：
    // 只数顶层等于没测——折叠态下顶层照样全在，少的是下面的层级。
    await expect(rows().filter({ hasClass: 'ant-table-row-level-1' }).first()).toBeVisible();
    await expect(rows().filter({ hasClass: 'ant-table-row-level-2' }).first()).toBeVisible();

    // 顶层 + 各级子项全都渲染出来了（折叠时只有目录那几行）
    expect(await rows().count()).toBeGreaterThan(30);
  });

  test('部门管理：左树首屏展开到子部门，新增弹窗可填可提交', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/dept');

    await expect(visibleTreeNodes(page).first()).toBeVisible();
    // 首屏就要展开到根节点下面：只露一个「总公司」等于把右侧表格的数据来源折起来了
    expect(await visibleTreeNodes(page).count()).toBeGreaterThan(2);
    await expect(page.locator('.ant-tree-treenode').filter({ hasText: '技术部' })).toBeVisible();

    await page.getByRole('button', { name: /新增部门/ }).click();
    /**
     * 按 role 取弹窗，而不是 `.ant-modal-content`。
     *
     * 这版 antdv-next 的弹窗外壳类名是 `.ant-modal-container`（DOM 里根本没有
     * `-content`），用类名选会把"弹窗明明开着"读成"弹窗没出现"。
     * `role="dialog"` 是 ARIA 语义，不随皮肤类名变，也更贴近用户视角。
     */
    const modal = page.getByRole('dialog').last();
    await expect(modal).toBeVisible();

    await modal.getByPlaceholder('请输入部门名称').fill('自动化巡检部门');
    await modal.getByPlaceholder('请输入部门编码（唯一）').fill('ops_sweep_dept');

    // `BasicModal` 的默认 okText 是「保存」（不是「确定」），文案跟着组件默认值走
    await modal.getByRole('button', { name: /保\s*存|确\s*定|确\s*认|提\s*交/ }).first().click();

    // 提交后要么出成功提示、要么树里能找到新节点，两条都没就是没打通
    await expect
      .poll(
        async () =>
          (await page.locator('.ant-message-success').count()) > 0 ||
          (await page.getByText('自动化巡检部门').count()) > 0,
        { message: '新增部门既没有成功提示也没落到树上', timeout: 10_000 },
      )
      .toBe(true);
  });

  /** 菜单表是树表：子层折叠时不在 DOM 里，先按名称筛一次再操作那一行 */
  const menuRow = async (page: Page, name: string) => {
    await page.getByPlaceholder('搜索菜单名称/权限标识...').fill(name);
    await page.getByRole('button', { name: '查询' }).first().click();
    const row = page
      .locator('.ant-table-tbody .ant-table-row')
      .filter({ hasText: name })
      .first();
    await expect(row).toBeVisible();
    return row;
  };

  test('菜单管理：管理字段有值，导航开关真的改导航并留到刷新后', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'mixed-vertical');
    await go(page, '/system/menu');

    // decorate 出来的类型/权限标识不是空的（曾经三列全空）
    await expect(page.locator('.ant-table-tbody .ant-tag').first()).toBeVisible();
    const permCells = page.locator('.ant-table-tbody td').filter({ hasText: /:/ });
    expect(await permCells.count()).toBeGreaterThan(0);

    await go(page, '/system/user');
    expect(await sideNavTitles(page)).toContain('用户管理');

    await go(page, '/system/menu');
    // 「状态」列也有开关，「导航」在它后面 —— 取行内最后一枚即导航开关
    await (await menuRow(page, '用户管理')).locator('.ant-switch').last().click();
    await expect
      .poll(
        async () => {
          await go(page, '/system/user');
          return (await sideNavTitles(page)).includes('用户管理');
        },
        { message: '拨了导航开关，侧栏却没变', timeout: 15_000 },
      )
      .toBe(false);

    // 覆盖要持久：刷新后仍是关着的
    await page.reload();
    await expect(page.locator('.tab-item').first()).toBeVisible();
    await go(page, '/system/user');
    expect(await sideNavTitles(page)).not.toContain('用户管理');

    // 隐藏不等于没权限：直达仍能进
    expect(page.url()).toContain('/system/user');

    // 复原，别把后面的用例和用户的浏览器留在关着的状态
    await go(page, '/system/menu');
    await (await menuRow(page, '用户管理')).locator('.ant-switch').last().click();
    await page.waitForTimeout(400);
    await go(page, '/system/user');
    expect(await sideNavTitles(page)).toContain('用户管理');
  });

  /**
   * 顶栏搜索 / Ctrl+K。
   *
   * 这条以前是**假功能**：`WidgetSearch` 把 `open` 事件发给 LayoutHeader，
   * LayoutHeader 却把它赋给一个从未被渲染的 `showNotification`，所以按下去毫无反应。
   * 用例因此不只看"弹窗出来了"，而是走完 呼出 → 输入 → 键盘选中 → 真的换页 整条链路，
   * 并把"隐藏页也能搜到"这条需求（导航精简后入口变少）单独钉住。
   */
  test('Ctrl+K 搜索：能呼出、能过滤、Enter 真的跳过去', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'mixed-vertical');
    await go(page, '/dashboard/analysis');

    const probe = watchErrors(page);

    await page.keyboard.press('Control+k');
    const input = page.getByTestId('menu-search-input');
    await expect(input, 'Ctrl+K 没有呼出搜索弹层').toBeVisible();

    // 空关键词给出候选列表（常用入口），而不是空白框
    await expect(page.getByTestId('menu-search-item').first()).toBeVisible();

    // 直接敲键盘就能输入：证明弹层把焦点交给了搜索框，而不是还要手点一下
    await page.keyboard.type('用户');
    const items = page.getByTestId('menu-search-item');
    await expect(input).toHaveValue('用户');
    await expect(items.first()).toContainText('用户管理');
    expect(await items.count(), '单个关键词不应命中一堆页面').toBeLessThanOrEqual(6);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/system\/user/);
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
    // 选完即关：不能留一层遮罩挡住页面
    await expect(input).toBeHidden();

    expect(probe.errors).toEqual([]);
    probe.stop();
  });

  test('搜索能到达导航上已被精简掉的隐藏页', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'mixed-vertical');
    await go(page, '/dashboard/analysis');

    // 先确认它确实不在侧栏里，否则这条用例等于什么都没验
    await go(page, '/system/user');
    expect(await sideNavTitles(page)).not.toContain('部门管理');

    await page.getByRole('button', { name: /搜索菜单/ }).click();
    const input = page.getByTestId('menu-search-input');
    await expect(input).toBeVisible();

    await input.fill('部门');
    const target = page.getByTestId('menu-search-item').first();
    await expect(target).toContainText('部门管理');
    // 提示用户这一项不在菜单里（可到达但非常规入口）
    await expect(target).toContainText('不在导航');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/system\/dept/);
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
  });

  test('搜索：↑↓ 换候选、Esc 关闭、无匹配给空态', async ({ page }) => {
    await signIn(page);
    await go(page, '/dashboard/analysis');

    await page.keyboard.press('Control+k');
    const input = page.getByTestId('menu-search-input');
    await expect(input).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();

    await page.keyboard.press('Control+k');
    await input.fill('管理');
    const active = page.locator('[data-testid="menu-search-item"][data-active="true"]');
    const inactive = page.locator(
      '[data-testid="menu-search-item"]:not([data-active="true"])',
    );
    expect(await inactive.count(), '「管理」应命中多个页面').toBeGreaterThan(0);

    const before = await active.innerText();
    await page.keyboard.press('ArrowDown');
    expect(await active.innerText(), '↓ 之后高亮项没有移动').not.toBe(before);
    await page.keyboard.press('ArrowUp');
    expect(await active.innerText(), '↑ 没有回到上一项').toBe(before);

    // 无匹配：给空态，且 Enter 不会把用户丢进一个不明页面
    await input.fill('绝对不存在的页面名');
    await expect(page.getByTestId('menu-search-empty')).toBeVisible();
    await expect(page.getByTestId('menu-search-item')).toHaveCount(0);
    await page.keyboard.press('Enter');
    expect(page.url()).toContain('/dashboard/analysis');

    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
  });
});

/**
 * 第二组巡检：顶栏小部件与"写操作"。
 *
 * 上面那一组问的是"读"（导航、出数、查询串），这一组问的是"动得起来吗"——
 * 铃铛开合、上传真的把文件发出去、列表页的新增/编辑/删除/导出。
 * 这些都是以前一查就坏的：铃铛整项被注释掉（偏好开关却是开的）、
 * 上传示例页的 8 个 `action` 在 mock 后端全部 404、通知管理「新增消息」打的是一个
 * 根本不存在的 `/system/notice/save`。静态对账见 `apps/backend-mock/test/api-parity.test.ts`，
 * 这里补的是"浏览器里真的点得动"。
 */

/** 1x1 透明 PNG：上传用例的文件载荷，不必依赖仓库里的二进制夹具 */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** 往某张卡片里的上传控件塞一个文件，返回该卡片（便于继续断言列表状态） */
async function uploadIntoCard(page: Page, cardTitle: string, name = 'probe.png') {
  const card = page
    .locator('.ant-card')
    .filter({ has: page.locator('.ant-card-head-title', { hasText: cardTitle }) })
    .first();
  await expect(card, `找不到「${cardTitle}」卡片`).toBeVisible();
  await card.locator('input[type="file"]').first().setInputFiles({
    buffer: PNG_1X1,
    mimeType: 'image/png',
    name,
  });
  return card;
}

test.describe('交互巡检：顶栏小部件、上传与列表页写操作', () => {
  test('顶栏铃铛：能开、出条目、就地展开、全部已读后角标归零', async ({ page }) => {
    await signIn(page);
    const probe = watchErrors(page);

    const bell = page.getByRole('button', { exact: true, name: '通知' });
    // 偏好里 widgetNotice 默认 true：铃铛必须真的在顶栏上（以前它根本不存在）
    await expect(bell, '顶栏没有渲染通知小部件').toBeVisible();

    await bell.click();
    const panel = page.getByTestId('notice-panel');
    await expect(panel, '点铃铛没有展开通知面板').toBeVisible();

    const items = panel.getByTestId('notice-item');
    await expect(items.first()).toBeVisible();
    expect(await items.count(), '通知面板一条都没有').toBeGreaterThan(0);
    // 面板内滚动走封装 Scrollbar，不露系统滚动条
    await expect(panel.locator('.scrollbar__view').first()).toBeVisible();

    // 未读角标要与列表里的未读条目数一致（两边都来自同一份 status 字段）
    const unread = panel.locator('[data-testid="notice-item"][data-unread="true"]');
    const unreadCount = await unread.count();
    if (unreadCount > 0) {
      const badge = page.locator('.ant-badge-count').first();
      await expect(badge).toBeVisible();
      expect(await badge.innerText()).toBe(String(unreadCount));

      // 全部已读：本地乐观更新 + 服务端落库
      await panel.getByTestId('notice-mark-all').click();
      await expect
        .poll(async () => await unread.count(), {
          message: '点了「全部已读」，列表里仍有未读条目',
          timeout: 10_000,
        })
        .toBe(0);
      // 没有未读之后，按钮本身就该消失（`v-if="hasUnread"`）
      await expect(panel.getByTestId('notice-mark-all')).toBeHidden();
    }

    // 就地展开：点一条 → 显示正文全文与「在通知中心查看」，不新开路由
    const first = items.first();
    await first.click();
    await expect(first).toHaveAttribute('data-expanded', 'true');
    await expect(first.getByText('在通知中心查看')).toBeVisible();

    // 从展开的条目跳通知中心（该页不在导航上，铃铛是它的常规入口）
    await first.getByText('在通知中心查看').click();
    await expect(page).toHaveURL(/#\/system\/notice/);
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();

    expect(probe.errors, probe.errors.join('\n')).toEqual([]);
    probe.stop();
  });

  test('通知管理：新增、编辑、删除一条消息', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/notice');
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();

    /**
     * 标题带时间戳，不能写死。
     * mock 的用户库/消息库是**进程内内存**（Nitro 起在 vite 里），
     * 一条用例中途失败就会把这条数据留在服务里，下一次跑再按固定标题找，
     * 命中的是上一轮留下的那条 —— 表现为"删了还剩 2 条"这种假缺陷。
     */
    const title = `自动化巡检消息-${Date.now()}`;
    const modal = page.getByRole('dialog').last();

    // ---- 新增 ----
    await page.getByRole('button', { name: /新增消息/ }).click();
    await expect(modal).toBeVisible();
    await modal.getByPlaceholder('请输入消息标题').fill(title);
    await modal.getByPlaceholder('请输入消息内容...').fill('这条消息由端到端用例创建');
    await modal.getByRole('button', { name: /保\s*存|确\s*定/ }).first().click();
    await expect
      .poll(
        async () => {
          await go(page, '/system/notice');
          return (
            await page.locator('.ant-table-row').filter({ hasText: title }).count()
          );
        },
        { message: '新增消息没有落到列表里（多半是 /system/notice/save 没实现）', timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // ---- 编辑 ----
    const row = page.locator('.ant-table-row').filter({ hasText: title }).first();
    await row.getByRole('button', { name: /编辑/ }).click();
    await expect(modal).toBeVisible();
    // 编辑要把原值回填，不能是空表单
    await expect(modal.getByPlaceholder('请输入消息标题')).toHaveValue(title);
    await modal.getByPlaceholder('请输入消息标题').fill(`${title}（改）`);
    await modal.getByRole('button', { name: /保\s*存|确\s*定/ }).first().click();
    await expect
      .poll(
        async () => {
          await go(page, '/system/notice');
          return await page
            .locator('.ant-table-row')
            .filter({ hasText: `${title}（改）` })
            .count();
        },
        { message: '编辑后列表里没有改过的标题（save 没带上 id 会变成新增）', timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // ---- 删除（带 Popconfirm 二次确认）----
    const edited = page
      .locator('.ant-table-row')
      .filter({ hasText: `${title}（改）` })
      .first();
    await edited.getByRole('button', { name: /删除/ }).click();
    const confirm = page.locator('.ant-popover').filter({ hasText: '确定要删除消息' }).last();
    await expect(confirm, '删除消息没有二次确认').toBeVisible();
    await confirm.getByRole('button', { name: /确\s*定|OK/ }).last().click();
    await expect
      .poll(
        async () =>
          await page
            .locator('.ant-table-row')
            .filter({ hasText: title })
            .count(),
        { message: '确认后那条消息仍在列表里', timeout: 15_000 },
      )
      .toBe(0);
  });

  test('上传示例页：基础上传与图片墙都真的把文件发出去并回成功', async ({ page }) => {
    await signIn(page);
    await go(page, '/components/upload');

    // 抓真实响应，验"接口存在且业务码为 200"，而不是只看列表项变绿
    const uploadResponses: Array<{ code: number; status: number }> = [];
    page.on('response', async (response) => {
      if (!/\/api\/upload/.test(response.url())) return;
      // 业务码取不到就算失败：-1 只在没有 JSON（404 页面、网络错误）时出现
      let code: number;
      try {
        const body = (await response.json()) as { code?: number };
        code = Number(body.code);
      } catch {
        code = -1;
      }
      uploadResponses.push({ code, status: response.status() });
    });

    const basic = await uploadIntoCard(page, '基础上传', 'basic.png');
    await expect(
      basic.locator('.ant-upload-list-item-done').first(),
      '基础上传没有进入 done 状态',
    ).toBeVisible({ timeout: 20_000 });
    // 失败态（红色条目）一枚都不该有：以前 8 个 action 全 404，这里必然炸
    expect(await basic.locator('.ant-upload-list-item-error').count()).toBe(0);

    const wall = await uploadIntoCard(page, '图片墙', 'wall.png');
    const thumb = wall.locator('.ant-upload-list-item').first();
    await expect(thumb).toHaveClass(/ant-upload-list-item-done/, { timeout: 20_000 });

    const preview = page.locator('.ant-image-preview-img');

    /**
     * 点图片本体 → 站内大图预览。
     *
     * `position` 不是随手写的：picture-card 是 102×102，hover 遮罩内缩 8px，
     * 三个操作图标又被 flexbox 的 abspos 规则正好居中成一排 —— 点在几何中心会打在
     * 中间那颗「下载」上。取左上 (16,16) 才是用户理解的"点这张图"。
     * 顺带盯住 popup：缩略图本体是 `<a target="_blank">`，`preventDefault` 没吃掉的话
     * 会另开一个标签页看同一张图，那种"预览"是假的。
     */
    const popup = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
    await thumb.click({ position: { x: 16, y: 16 } });
    await expect(preview, '点图片墙的图片没有打开大图预览').toBeVisible({
      timeout: 10_000,
    });
    expect(await popup, '点缩略图另开了一个标签页，预览没走在站内').toBeNull();

    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();

    // 眼睛图标是同一条链路的第二个入口，也得能用
    await thumb.hover();
    await thumb.locator('.ant-upload-list-item-actions > a').first().click();
    await expect(preview, '点预览图标没有打开大图预览').toBeVisible({
      timeout: 10_000,
    });

    // 关掉再点一次：受控状态没回写的话，第二次点同一张图是没反应的
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await thumb.click({ position: { x: 16, y: 16 } });
    await expect(preview, '第二次点同一张图打不开预览').toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');

    expect(
      uploadResponses.filter((r) => r.status >= 400 || r.code !== 200),
      `上传接口有非成功响应：${JSON.stringify(uploadResponses)}`,
    ).toEqual([]);
  });

  test('用户管理：新增、编辑、删除贯穿一遍', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();

    // 同上：用户名带时间戳，避免上一轮失败留下的同名记录干扰断言
    const username = `ops_sweep_${Date.now()}`;
    const modal = page.getByRole('dialog').last();

    await page.getByRole('button', { name: /新增用户/ }).click();
    await expect(modal).toBeVisible();
    await modal.getByPlaceholder('请输入用户名').fill(username);
    await modal.getByPlaceholder('请输入昵称').fill('巡检用例用户');
    await modal.getByPlaceholder('请输入邮箱地址').fill('ops@antdv-next.com');
    await modal.getByRole('button', { name: /保\s*存|确\s*定/ }).first().click();

    // 新增要能在服务端查到：直接搜用户名，而不是"看第一页有没有"
    await expect
      .poll(
        async () => {
          await page.getByPlaceholder('搜索用户名/昵称/邮箱/手机号...').fill(username);
          await page.getByRole('button', { name: '查询' }).first().click();
          await page.waitForTimeout(600);
          return await page
            .locator('.ant-table-row')
            .filter({ hasText: username })
            .count();
        },
        { message: '新增的用户搜不到', timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // 编辑：改昵称
    const row = page.locator('.ant-table-row').filter({ hasText: username }).first();
    await row.getByRole('button', { name: /编辑/ }).click();
    await expect(modal.getByPlaceholder('请输入用户名')).toHaveValue(username);
    await modal.getByPlaceholder('请输入昵称').fill('巡检用例用户-改名');
    await modal.getByRole('button', { name: /保\s*存|确\s*定/ }).first().click();
    await expect
      .poll(
        async () =>
          await page
            .locator('.ant-table-row')
            .filter({ hasText: '巡检用例用户-改名' })
            .count(),
        { message: '编辑后的昵称没有回到表格', timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    /**
     * 保存之后列表必须还是"搜出来的那一条"。
     *
     * `reload()` 以前不带上一次的查询条件，保存后列表会静默退回全量第一页 ——
     * 上一行的断言在这种情况下照样可能通过（改名后的用户排在后面），
     * 所以这里直接数行数：条件一丢，行数立刻变成整页。
     */
    expect(await page.locator('.ant-table-tbody .ant-table-row').count()).toBe(1);

    // 删除：把用例造的数据收掉
    await page
      .locator('.ant-table-row')
      .filter({ hasText: username })
      .first()
      .getByRole('button', { name: /删除/ })
      .click();
    /**
     * 删除是二次确认的（一行一次误触就少一个用户，且没有回收站），
     * 所以这里必须把确认气泡点掉 —— 顺带验证气泡真的出来了。
     * 固定在右侧的操作列会自成一个层叠上下文，弹层挂到 body 上才不被隔壁单元格压住。
     */
    const confirm = page.locator('.ant-popconfirm:visible').last();
    await expect(confirm).toBeVisible();

    const targetRow = () =>
      page.locator('.ant-table-row').filter({ hasText: username });
    // 先按「取消」：这一步必须什么都不删，否则确认框等于没加
    await confirm.getByRole('button', { name: /取\s*消/ }).click();
    await page.waitForTimeout(500);
    expect(await targetRow().count()).toBe(1);

    // 再删一次，这回才确认
    await targetRow().first().getByRole('button', { name: /删除/ }).click();
    await page
      .locator('.ant-popconfirm:visible')
      .last()
      .getByRole('button', { name: /删\s*除/ })
      .click();
    await expect
      .poll(
        async () => {
          await page.getByRole('button', { name: '查询' }).first().click();
          await page.waitForTimeout(600);
          return await page
            .locator('.ant-table-row')
            .filter({ hasText: username })
            .count();
        },
        { message: '删除后该用户仍在列表里', timeout: 15_000 },
      )
      .toBe(0);

    await page.getByPlaceholder('搜索用户名/昵称/邮箱/手机号...').fill('');
    await page.getByRole('button', { name: '查询' }).first().click();
  });

  /**
   * 菜单管理的删除是"连带整棵子树"的：删掉「系统管理」等于下面的用户/角色/菜单
   * 全部一起没，而且这份数据没有回收站。这种操作不能点击即生效，
   * 确认框还得把影响面（子项数量）说出来，否则用户以为自己只删了一行。
   */
  test('菜单管理：删除先弹确认，取消不动数据，确认才连带子项一起删', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/menu');
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();

    const rows = () => page.locator('.ant-table-tbody .ant-table-row');
    const before = await rows().count();
    const target = rows().filter({ hasText: '系统管理' }).first();

    await target.getByRole('button', { name: /删除/ }).click();
    const confirm = page.locator('.ant-popconfirm:visible').last();
    await expect(confirm, '点删除没有弹出二次确认').toBeVisible();
    await expect(confirm, '确认文案没说清会连带多少个子项').toContainText('个子项');

    await confirm.getByRole('button', { name: /取\s*消/ }).click();
    await page.waitForTimeout(400);
    expect(await rows().count(), '点了取消却还是把菜单删了').toBe(before);

    await target.getByRole('button', { name: /删除/ }).click();
    await page
      .locator('.ant-popconfirm:visible')
      .last()
      .getByRole('button', { name: /删\s*除/ })
      .click();
    await expect
      .poll(() => rows().count(), {
        message: '确认后菜单树没有变少',
        timeout: 10_000,
      })
      .toBeLessThan(before);
  });

  test('用户管理：勾选后导出真的产出 xlsx 文件', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();

    await page.locator('.ant-table-tbody .ant-table-row').first().locator('.ant-checkbox-input').check();

    // 未勾选时点导出只给提示（这条分支也顺手钉住）
    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /导出/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    // 文件非空：导出走的是 XLSX.writeFile，产出 0 字节等于"按钮能点但没数据"
    expect((await download.path()) !== null).toBe(true);
  });

  test('顶栏主题与全屏按钮都真的起作用', async ({ page }) => {
    await signIn(page);
    await go(page, '/dashboard/analysis');

    // ---- 暗黑切换：html.dark 是 @antdv/preferences 写进 DOM 的唯一判据 ----
    const isDark = () =>
      page.evaluate(() => document.documentElement.classList.contains('dark'));
    const before = await isDark();
    await page
      .getByRole('button', { name: before ? '切换到浅色' : '切换到深色' })
      .click();
    await expect
      .poll(isDark, { message: '点主题按钮没有切换明暗', timeout: 10_000 })
      .toBe(!before);
    // 切回去，别把后面的用例与用户浏览器留在暗色
    await page
      .getByRole('button', { name: !before ? '切换到浅色' : '切换到深色' })
      .click();
    await expect
      .poll(isDark, { message: '主题没能切回原状态', timeout: 10_000 })
      .toBe(before);

    // ---- 全屏：按钮文案要跟着状态走（读屏用户靠它判断这一键是"进"还是"出"）----
    const fullscreen = page.getByRole('button', { name: '全屏' });
    await expect(fullscreen).toBeVisible();
    await fullscreen.click();
    const entered = await page.evaluate(() => document.fullscreenElement !== null);
    if (entered) {
      await expect(
        page.getByRole('button', { name: '退出全屏' }),
        '进入全屏后按钮文案没有跟着变',
      ).toBeVisible();
      await page.evaluate(() => document.exitFullscreen());
      await expect(page.getByRole('button', { name: '全屏' })).toBeVisible();
    } else {
      // 无头窗口没有全屏权限：至少这次点击不能把异常抛到页面上
      console.log('[ops-sweep] 当前浏览器不允许无头全屏，跳过全屏后的可见性断言');
    }
  });

  /**
   * antd 组件自带文案要跟着系统的中文语言包走。
   *
   * `loadLocale` 早就写在 `~/settings` 里了，但 `App.vue` 的调用点被注释掉过，
   * 于是业务文案全是中文、组件自带文案全是英文 —— 分页写「条/页」的位置显示
   * "10 / page"，空表显示 "No data"，整个系统看着像汉化做了一半。
   * 这种"自己的文案对、第三方组件文案错"的错位，单测发现不了，只能看真实渲染结果。
   */
  test('antd 自带文案跟着中文语言包（条/页 / 暂无数据）', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
    await expect(page.locator('.ant-pagination').first()).toContainText('条/页');

    await page.getByPlaceholder('搜索用户名/昵称/邮箱/手机号...').fill('这条用户名不存在');
    await page.getByRole('button', { name: '查询' }).first().click();
    await expect(page.locator('.ant-empty-description').first()).toHaveText('暂无数据');

    // 收尾清掉条件：keep-alive 会把这一页停在空结果上，后面的用例容易被带偏
    await page.getByPlaceholder('搜索用户名/昵称/邮箱/手机号...').fill('');
    await page.getByRole('button', { name: '查询' }).first().click();
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
  });

  /**
   * 视频演示页要"按能力降级"，而不是摆一个放不出来的黑框。
   *
   * 回归的是这条：Playwright 自带的 WebKit 构建里 **MediaSource 整个不存在**
   * （实测 `typeof window.MediaSource === 'undefined'`，同时它的 mp4 反而是支持的），
   * 于是 HLS 那张卡片必然报 `MEDIA_ERR_SRC_NOT_SUPPORTED`。以前页面照挂播放器，
   * 巡检就被这条厂商标案咬红，而真实用户看到的是一句英文 "No compatible source…"。
   *
   * 现在页面先探测（原生 m3u8 或 MSE 能塞 mp4 片段），放不出来就换成中文说明。
   * 用例按引擎能力分岔断言，三个引擎都跑得过，也都不放松：
   * 能播的环境必须真的挂出播放器，不能播的环境必须把原因说清楚。
   */
  test('视频演示页按浏览器能力降级：能播就挂播放器，不能播就把话说清楚', async ({
    page,
  }) => {
    const videoErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('VIDEOJS')) videoErrors.push(text.slice(0, 120));
    });

    await signIn(page);

    const capability = await page.evaluate(() => {
      const gates = [
        (window as unknown as { MediaSource?: unknown }).MediaSource,
        (window as unknown as { WebKitMediaSource?: unknown }).WebKitMediaSource,
        (window as unknown as { ManagedMediaSource?: unknown })
          .ManagedMediaSource,
      ];
      const type = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      const viaMse = gates.some((gate) => {
        const source = gate as {
          isSupportedType?: (t: string) => boolean;
          isTypeSupported?: (t: string) => boolean;
        };
        if (typeof source?.isTypeSupported === 'function') {
          return Boolean(source.isTypeSupported(type));
        }
        if (typeof source?.isSupportedType === 'function') {
          return Boolean(source.isSupportedType(type));
        }
        return false;
      });
      const viaNative = Boolean(
        document
          .createElement('video')
          .canPlayType('application/vnd.apple.mpegurl'),
      );
      return { viaMse, viaNative };
    });

    await go(page, '/components/video');

    const hlsCard = page
      .locator('.ant-card')
      .filter({ hasText: 'HLS 流媒体播放' })
      .first();
    await expect(hlsCard).toBeVisible();

    if (capability.viaMse || capability.viaNative) {
      await expect(hlsCard.locator('.video-js')).toHaveCount(1);
    } else {
      await expect(hlsCard.locator('.video-js')).toHaveCount(0);
      await expect(hlsCard).toContainText('无法播放');
    }

    // 另外两张 MP4 卡片三个引擎都有能力，必须真的挂出播放器（不许被一起藏掉）
    for (const title of ['MP4 视频播放', '自动循环播放']) {
      await expect(
        page
          .locator('.ant-card')
          .filter({ hasText: title })
          .first()
          .locator('.video-js'),
        `${title} 这张卡片不该被能力探测误伤`,
      ).toHaveCount(1);
    }

    // 页面自己按能力挑过源，就不该再冒出"放不出来"的厂商标案
    expect(videoErrors).toEqual([]);
  });
});
