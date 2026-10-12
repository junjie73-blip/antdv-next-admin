import { expect, test } from '@playwright/test';

import {
  fillAccount,
  go,
  HOME_PATH,
  LIMITED_ACCOUNT,
  navigate,
  readAccess,
  signIn,
  submitLogin,
} from './utils/app';

/**
 * 双账号权限：菜单即权限，所以"接口返回什么树"直接决定"另一个人能进哪些页面"。
 *
 * 落点选 `/system/menu`（菜单管理）做越界探针：它是 admin 有、custom 没有的二级页面，
 * 而且是**真实存在的路由** —— 用不存在的 path 探针会把"守卫拦下 403"和
 * "路由表里压根没有这条"混为一谈（后者也落 403，但证明不了权限生效）。
 *
 * custom 的白名单只给了一部分页面（见 `apps/backend-mock/server/utils/accounts.ts`），
 * 断言一律按"有没有 SystemMenu"这种语义写，不钉总条数：菜单增删是常态，
 * 钉死数字的用例每次加页面都要回来改，改的人只会把数字改成当下看到的 ——
 * 那样的断言不再表达任何约束。
 */

/** 受限账号该看到的落点（用来确认"裁剪不是全裁"） */
const CUSTOM_ALLOWED = [
  '/system/user',
  '/components/table/basic',
  // 增删改查示例：custom 的白名单里有 DemoTableCrud，但少了 demo:task:remove
  // —— 页面进得去、删除按钮看不见，这条不对称由 table-crud.spec.ts 展开
  '/components/table/crud',
];
/** 只有超管能进的落点 */
const ADMIN_ONLY = ['/system/menu', '/system/dept', '/components/form/basic'];

test.describe('两种权限账号的授权生成', () => {
  test('超管拿到全量菜单，权限码是通配', async ({ page }) => {
    await signIn(page);
    const access = await readAccess(page);

    expect(access.username).toBe('admin');
    expect(access.permissions).toEqual(['*']);
    await expect(page.locator('[data-layout-region="sidebar"]')).toBeVisible();
    // 目录节点也要在授权集里：登录后的默认落点 /dashboard 靠它解析到第一个可见叶子
    for (const name of ['SystemManage', 'SystemMenu', 'Demo']) {
      expect(access.allowedNames, `admin 缺少 ${name}`).toContain(name);
    }
    for (const path of ADMIN_ONLY) {
      expect(access.allowedPaths, `admin 缺少 ${path}`).toContain(path);
    }
  });

  test('受限账号只拿到白名单里的页面，父壳跟着孩子留下', async ({ page }) => {
    await signIn(page, LIMITED_ACCOUNT);
    const access = await readAccess(page);

    expect(access.username).toBe('custom');
    // 通配符绝不能出现在受限账号身上 —— 这是"所有账号都是超管"的那条静默失效路径
    expect(access.permissions).not.toContain('*');
    expect(access.permissions.length).toBeGreaterThan(0);

    for (const name of ['SystemUser', 'SystemRole', 'DemoTableBasic']) {
      expect(access.allowedNames, `custom 应有 ${name}`).toContain(name);
    }
    // 目录节点保留（它的孩子还在），被裁掉的叶子必须一个都不能剩
    expect(access.allowedNames).toContain('SystemManage');
    for (const name of ['SystemMenu', 'SystemDept', 'DemoFormBasic']) {
      expect(access.allowedNames, `custom 不该有 ${name}`).not.toContain(name);
    }
    for (const path of ADMIN_ONLY) {
      expect(access.allowedPaths, `custom 不该有 ${path}`).not.toContain(path);
    }
    for (const path of CUSTOM_ALLOWED) {
      expect(access.allowedPaths, `custom 应有 ${path}`).toContain(path);
    }
  });

  test('受限账号的侧边栏不再渲染被裁掉的入口', async ({ page }) => {
    await signIn(page, LIMITED_ACCOUNT);

    const sidebar = page.locator('[data-layout-region="sidebar"]');
    // antd 的内联子菜单收起时不渲染孩子，先展开「系统管理」再断言里面的项
    await sidebar
      .locator('.ant-menu-submenu-title', { hasText: '系统管理' })
      .first()
      .click();
    await expect(
      sidebar
        .locator('.ant-menu-title-content', { hasText: '用户管理' })
        .first(),
    ).toBeVisible();
    await expect(
      sidebar.locator('.ant-menu-title-content', { hasText: '菜单管理' }),
    ).toHaveCount(0);
    await sidebar
      .locator('.ant-menu-submenu-title', { hasText: '组件示例' })
      .first()
      .click();
    // 「表单」整节都不在 custom 的白名单里，展开后它连子菜单都不该出现
    await expect(
      sidebar.locator('.ant-menu-title-content', { hasText: '表单' }),
    ).toHaveCount(0);
    await expect(
      sidebar
        .locator('.ant-menu-title-content', { hasText: '示例总览' })
        .first(),
    ).toBeVisible();
  });

  test('直达越界链接落 403，而不是渲染出别人的页面', async ({ page }) => {
    await signIn(page, LIMITED_ACCOUNT);

    for (const path of ADMIN_ONLY) {
      await navigate(page, path);
      await expect(page, `${path} 应当被守卫拦下`).toHaveURL(/#\/error\/403/);
    }

    /**
     * 反向对照：地址真的不存在时仍然要是 404。
     * 少了这条，"越权 → 403"与"打错 → 404"的分岔会被写成同一个落点而没人发现
     * （403 分支靠的是"全量快照里有这条页面"，写错了就永远走 404 那半边）。
     */
    await navigate(page, '/components/this-page-does-not-exist');
    await expect(page, '乱敲的地址不该被说成没权限').toHaveURL(/#\/error\/404/);
  });

  test('白名单内的页面照常可进', async ({ page }) => {
    await signIn(page, LIMITED_ACCOUNT);

    for (const path of CUSTOM_ALLOWED) {
      await go(page, path);
      await expect(page, `${path} 应该进得去`).toHaveURL(
        new RegExp(`#${path}(\\?|$)`),
      );
    }
  });

  test('整页刷新后凭证还能当请求头用，授权仍是这个账号的', async ({ page }) => {
    await signIn(page, LIMITED_ACCOUNT);
    await go(page, CUSTOM_ALLOWED[0]);

    /**
     * 刷新时 store 只能从缓存同步读到 **JWE 密文**，入口必须在挂载前把它解开。
     * 少这一步，发出去的是 `Bearer eyJhbGci...`：mock 认不出人 → 回落默认账号 →
     * 表现成"custom 刷新一次就变超管"。所以这里直接断请求头，而不是只看页面。
     */
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/menus'), {
        timeout: 60_000,
      }),
      page.reload(),
    ]);
    expect(request.headers().authorization).toMatch(
      /^Bearer mock_token_custom_\d+$/,
    );

    await expect(page.locator('[data-layout-region="sidebar"]')).toBeVisible();
    const access = await readAccess(page);
    expect(access.username).toBe('custom');
    expect(access.allowedNames).toContain('SystemUser');
    expect(access.allowedNames).not.toContain('SystemMenu');
    // 刷新回的是受限页，不是被守卫顶回登录页
    await expect(page).not.toHaveURL(/#\/login/);
  });

  test('换账号进来不会带上一人的授权', async ({ page }) => {
    await signIn(page);
    expect((await readAccess(page)).allowedNames).toContain('SystemMenu');

    // 不整页刷新：走「退出 → 登录」这条同一个文档会话内的路径。
    // `logout()` 是会话态清理的唯一出口（守卫、401 收尾都走它），这里直接调它，
    // 再验新账号拿到的授权集是自己那份而不是上一个人的。
    await page.evaluate(() => {
      const host = document.querySelector('#app') as Element & {
        __vue_app__?: {
          config?: {
            globalProperties?: { $pinia?: { _s?: Map<string, any> } };
          };
        };
      };
      host
        .__vue_app__!.config!.globalProperties!.$pinia!._s!.get('user')!
        .logout();
    });
    await navigate(page, '/login');
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();

    await fillAccount(page, LIMITED_ACCOUNT);
    await submitLogin(page);
    await expect(page).toHaveURL(new RegExp(`#${HOME_PATH}`));

    const access = await readAccess(page);
    expect(access.username).toBe('custom');
    expect(access.permissions).not.toContain('*');
    expect(access.allowedNames).not.toContain('SystemMenu');
    expect(access.allowedNames).toContain('SystemUser');
  });
});
