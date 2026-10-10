import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, HOME_PATH, navigate, setPreference, signIn, tab } from './utils/app';

/**
 * 标签页的浏览器级行为。
 *
 * store 里的数据变换（关闭左右、排序校验、固定区不变量）已经有单元测试，
 * 这个文件只补单元测试够不着的那三层：
 * 1. **拖拽**：SortableJS 真的动了 DOM 节点，Vue 的虚拟 DOM 有没有跟着对齐
 *    （顺序错乱 / 重复节点只在浏览器里才出现）；
 * 2. **右键菜单**：Teleport 到 body 的浮层、坐标、点击外部关闭，这些没有真实
 *    事件循环就验不到；
 * 3. **设置入口**：偏好字段（tabStyle / tabDragSort / tabContextMenu）必须由
 *    设置抽屉里点得到，否则功能只存在于代码里，用户永远切不过去。
 */

const USER = '/system/user';
const ROLE = '/system/role';
const DEPT = '/system/dept';

/** 依次打开三个业务标签：首页（固定）+ 用户 + 角色 + 岗位 */
async function openThree(page: Page) {
  await go(page, USER);
  await go(page, ROLE);
  await go(page, DEPT);
  await expect(page.locator('.tab-item')).toHaveCount(4);
}

/** 当前标签顺序（用 data-scroll-key，比标题稳定） */
function tabOrder(page: Page): Promise<string[]> {
  return page
    .locator('.tab-item')
    .evaluateAll((list) => list.map((el) => el.getAttribute('data-scroll-key') ?? ''));
}

/**
 * 右键标签呼出菜单。
 *
 * 定位器必须带 `name`：antd 的侧边/顶部菜单本身就是 `ul[role="menu"]`，
 * 只写 `[role="menu"]` 会一次命中 4 个节点（strict mode 直接报错，
 * 而更糟的是它可能悄悄命中侧边菜单，把"菜单没弹出来"跑成"断言通过"）。
 */
async function rightClickTab(page: Page, path: string): Promise<Locator> {
  await tab(page, path).click({ button: 'right' });
  const menu = contextMenu(page);
  await expect(menu).toBeVisible();
  return menu;
}

function contextMenu(page: Page): Locator {
  return page.getByRole('menu', { exact: true, name: '标签页操作' });
}

/**
 * 拖拽排序。
 *
 * 用 `dragTo` 而不是手搓 mouse.down/move/up：SortableJS 给节点加了 `draggable`，
 * 走的是浏览器原生 HTML5 拖拽，Playwright 的 dragTo 会连 dragstart/dragover/drop
 * 一起补全；手搓鼠标事件反而只发到一半（原生拖拽一旦开始就接管了鼠标）。
 */
async function dragTab(page: Page, fromPath: string, toPath: string) {
  await tab(page, fromPath).dragTo(tab(page, toPath));
}

test.describe('标签页交互', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('右键「关闭其他」只留首页与目标标签', async ({ page }) => {
    await openThree(page);

    const menu = await rightClickTab(page, ROLE);
    await expect(menu.getByRole('menuitem', { name: /关闭其他/ })).toBeVisible();
    await menu.getByRole('menuitem', { name: /关闭其他/ }).click();

    await expect(page.locator('.tab-item')).toHaveCount(2);
    await expect(tab(page, HOME_PATH)).toBeVisible();
    await expect(tab(page, ROLE)).toBeVisible();
    await expect(tab(page, USER)).toHaveCount(0);
    await expect(tab(page, DEPT)).toHaveCount(0);
    // 关完菜单要收起，不能留一块透明的拦截层
    await expect(contextMenu(page)).toHaveCount(0);
    // 关闭其他之后，激活项跟着落到被保留的那个标签
    await expect(tab(page, ROLE)).toHaveAttribute('data-active', 'true');
    await expect(page).toHaveURL(new RegExp(`#${ROLE}$`));
  });

  test('右键「关闭左侧」保留固定首页，右侧不动', async ({ page }) => {
    await openThree(page);

    const menu = await rightClickTab(page, DEPT);
    const closeLeft = menu.getByRole('menuitem', { name: /关闭左侧/ });
    // 计数写进文案，用户点之前就知道会关掉几个
    await expect(closeLeft).toHaveText(/关闭左侧（2）/);
    await closeLeft.click();

    const order = await tabOrder(page);
    expect(order).toEqual([HOME_PATH, DEPT]);
  });

  test('右键「关闭全部」退回只剩首页', async ({ page }) => {
    await openThree(page);

    const menu = await rightClickTab(page, ROLE);
    await menu.getByRole('menuitem', { name: '关闭全部' }).click();

    await expect(page.locator('.tab-item')).toHaveCount(1);
    await expect(tab(page, HOME_PATH)).toHaveAttribute('data-active', 'true');
  });

  test('放大当前标签页收起导航外壳，标签栏留着并给出还原入口', async ({ page }) => {
    await go(page, USER);

    const menu = await rightClickTab(page, USER);
    await menu.getByRole('menuitem', { name: '放大当前页' }).click();

    // 头部与侧栏都撤掉，内容区独占视口
    await expect(page.locator('.ant-layout-header')).toHaveCount(0);
    await expect(page.locator('[data-layout-region="sidebar"]')).toHaveCount(0);
    /**
     * 标签栏是**故意留下的**（`useLayoutRegions.tabsVisible` 只看蓝图 chromeless，
     * 不把 maximized 算进去）：放大态下还得靠它切页 / 右键还原，否则用户只能
     * 依赖右下角那颗悬浮按钮。这里把这条设计钉住，防止被"顺手"改成一起隐藏。
     */
    await expect(tab(page, USER)).toBeVisible();

    const restore = page.getByRole('button', { name: '还原标签页' });
    await expect(restore).toBeVisible();

    // 放大态下右键同一标签，菜单文案跟着变成「还原当前页」
    const menu2 = await rightClickTab(page, USER);
    await expect(menu2.getByRole('menuitem', { name: '还原当前页' })).toBeVisible();
    await page.keyboard.press('Escape');

    await restore.click();
    await expect(page.locator('.ant-layout-header')).toBeVisible();
    await expect(page.locator('[data-layout-region="sidebar"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '还原标签页' })).toHaveCount(0);
  });

  test('固定标签后不可关闭，且并到固定区末尾', async ({ page }) => {
    await go(page, USER);
    await go(page, ROLE);

    const menu = await rightClickTab(page, ROLE);
    await menu.getByRole('menuitem', { name: '固定标签页' }).click();

    let order = await tabOrder(page);
    expect(order.slice(0, 2)).toEqual([HOME_PATH, ROLE]);
    // 固定标签不给关闭按钮
    await expect(tab(page, ROLE).locator('.anticon-close')).toHaveCount(0);

    // 取消固定：回到非固定区，关闭按钮重新出现
    const menu2 = await rightClickTab(page, ROLE);
    await menu2.getByRole('menuitem', { name: '取消固定' }).click();
    order = await tabOrder(page);
    expect(order[0]).toBe(HOME_PATH);
    await expect(tab(page, ROLE).locator('.anticon-close')).toBeVisible();
  });

  test('首页那一格不给「取消固定」，避免首页身份漂移', async ({ page }) => {
    const menu = await rightClickTab(page, HOME_PATH);
    await expect(menu.getByRole('menuitem', { name: /取消固定|固定标签页/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: '关闭当前' })).toBeDisabled();
  });

  test('点标签外部与按 Escape 都能关掉右键菜单', async ({ page }) => {
    await go(page, USER);

    await rightClickTab(page, USER);
    await page.mouse.click(5, 5);
    await expect(contextMenu(page)).toHaveCount(0);

    await rightClickTab(page, USER);
    await page.keyboard.press('Escape');
    await expect(contextMenu(page)).toHaveCount(0);
  });

  test('拖拽排序：顺序写回 store，固定首页留在最前，激活态不被打断', async ({ page }) => {
    await openThree(page);
    await navigate(page, USER);
    await expectActive(page, USER);

    await dragTab(page, DEPT, ROLE);

    const order = await tabOrder(page);
    // 岗位被拖到角色之前：[首页, 用户, 岗位, 角色]
    expect(order).toEqual([HOME_PATH, USER, DEPT, ROLE]);
    // 拖拽不该把用户当前看的那个标签切走
    await expectActive(page, USER);
  });

  test('拖拽不许越过固定区，且关掉拖拽开关后排序失效', async ({ page }) => {
    await openThree(page);

    const before = await tabOrder(page);
    // 把「岗位」拖到首页前面：onMove 拒绝，顺序必须原样不动
    await dragTab(page, DEPT, HOME_PATH);
    await expect.poll(() => tabOrder(page)).toEqual(before);

    await setPreference(page, { tabDragSort: false });
    await dragTab(page, DEPT, USER);
    await expect.poll(() => tabOrder(page)).toEqual(before);

    // 开关再打开，同一个动作就该生效了 —— 证明上面那次"没动"是被开关拦的，不是拖拽本身坏了
    await setPreference(page, { tabDragSort: true });
    await dragTab(page, DEPT, USER);
    await expect.poll(() => tabOrder(page)).toEqual([HOME_PATH, DEPT, USER, ROLE]);
  });

  test('设置抽屉里的标签风格能真的改掉外观', async ({ page }) => {
    await go(page, USER);
    const drawer = await openLayoutPanel(page);

    const active = tab(page, USER);
    // 默认卡片风格：激活标签是实心底色 + 圆角方框
    await expect(active).toHaveClass(/rounded-md/);

    await drawer.getByText('胶囊', { exact: true }).click();
    await expect(active).toHaveClass(/rounded-full/);
    await expect(active).not.toHaveClass(/rounded-md/);

    await drawer.getByText('下划线', { exact: true }).click();
    await expect(active).toHaveClass(/border-b-2/);

    await drawer.getByText('纯文本', { exact: true }).click();
    // 纯文本风格靠容器上的 divide-x 画分隔线
    await expect(page.locator('.tab-list')).toHaveClass(/divide-x/);

    await setPreference(page, { tabStyle: 'card' });
    await expect(active).toHaveClass(/rounded-md/);
  });

  test('关掉「右键菜单」开关后右键不再呼出菜单', async ({ page }) => {
    await go(page, USER);

    await rightClickTab(page, USER);
    await page.keyboard.press('Escape');

    await setPreference(page, { tabContextMenu: false });
    await tab(page, USER).click({ button: 'right' });
    await expect(contextMenu(page)).toHaveCount(0);

    await setPreference(page, { tabContextMenu: true });
    await rightClickTab(page, USER);
  });

  test('右上角「标签页操作」下拉与右键菜单是同一套动作', async ({ page }) => {
    await openThree(page);

    await page.getByRole('button', { name: '标签页操作' }).click();
    const dropdown = page.locator('.ant-dropdown').last();
    await expect(dropdown).toBeVisible();
    await dropdown.getByRole('menuitem', { name: /关闭其他/ }).click();

    // 下拉不带目标标签，动作作用在当前激活项（岗位）上
    await expect(page.locator('.tab-item')).toHaveCount(2);
    await expect(tab(page, DEPT)).toHaveAttribute('data-active', 'true');
  });

  test('关掉标签后焦点交给邻居，不会出现"没有任何标签是激活的"', async ({ page }) => {
    await openThree(page);
    await navigate(page, DEPT);
    await expectActive(page, DEPT);

    await tab(page, DEPT).locator('.anticon-close').click();

    await expect(page.locator('.tab-item')).toHaveCount(3);
    await expect(tab(page, ROLE)).toHaveAttribute('data-active', 'true');
    await expect(page).toHaveURL(new RegExp(`#${ROLE}$`));
  });

  test('标签栏溢出时箭头出现，单击步滚、双击到底', async ({ page }) => {
    const paths = [
      USER,
      ROLE,
      DEPT,
      '/system/menu',
      '/system/post',
      '/system/notice',
      '/system/online',
      '/system/file',
      '/system/dict',
      '/system/log',
    ];
    for (const path of paths) await go(page, path);
    // 收窄视口逼它溢出（与横向菜单那条用例同一手法）：1280 宽时这些标签放得下，
    // 箭头按设计不出现，用例就会在"找不到按钮"上红 —— 那是设置问题不是功能问题。
    await page.setViewportSize({ height: 720, width: 720 });

    /**
     * 标签栏的滚动元素现在是封装 Scrollbar 的滚动层（`.tab-scroll` 由 wrap-class 给），
     * 早先这里是自写的 `div[data-tab-scroll] + overflow-x-auto`。
     * 读滚动距离必须打在真正滚的那个元素上，否则量到的永远是 0。
     */
    const scroller = page.locator('.tab-scroll');
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: '窄视口下标签栏应当溢出',
      })
      .toBeGreaterThan(0);

    const right = page.getByRole('button', { name: '向右滚动标签栏' });
    await expect(right).toBeVisible();
    const lastTab = tab(page, '/system/log');
    await expect(lastTab).not.toBeInViewport();

    // 单击按 step（160px）前进：溢出几百 px，一步到底不现实，只验证"确实在滚"
    const before = await scroller.evaluate((el) => el.scrollLeft);
    await right.click();
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollLeft), {
        message: '点一次右箭头应当真的滚动一段距离',
        // smooth 滚动落地需要时间，poll 到不再变化为止
      })
      .toBeGreaterThan(before);

    // 双击 = 一步到底：最右一个标签进入视野（"箭头能访问全部标签"的字面验收）
    await right.dblclick();
    await expect
      .poll(() =>
        scroller.evaluate(
          (el) => el.scrollWidth - el.clientWidth - el.scrollLeft,
        ),
      )
      .toBeLessThanOrEqual(2);
    await expect(lastTab).toBeInViewport();

    // 双击左箭头回到最左
    const left = page.getByRole('button', { name: '向左滚动标签栏' });
    await left.dblclick();
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollLeft))
      .toBeLessThanOrEqual(2);
  });
});

/** 激活态断言：`data-active` 而不是 class，风格切换不影响它 */
function expectActive(page: Page, path: string) {
  return expect(tab(page, path)).toHaveAttribute('data-active', 'true');
}

/** 打开右侧设置抽屉并切到「布局」面板 */
async function openLayoutPanel(page: Page) {
  await page.getByRole('button', { name: '偏好设置' }).click();
  const drawer = page.locator('.setting-drawer');
  await expect(drawer).toBeVisible();
  await drawer.locator('.ant-segmented-item', { hasText: '布局' }).click();
  await expect(drawer.getByText('标签风格')).toBeVisible();
  return drawer;
}
