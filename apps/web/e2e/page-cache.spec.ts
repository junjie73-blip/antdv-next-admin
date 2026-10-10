import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  expectActivePath,
  fillAccount,
  go,
  HOME_PATH,
  navigate,
  searchBox,
  signIn,
  submitLogin,
  switchAwayAndBack,
  tab,
  watchErrors,
} from './utils/app';

/**
 * 标签页页面缓存（keep-alive）端到端验收。
 *
 * 为什么值得单独一套用例：`<KeepAlive :include>` 匹配的是**组件名**，
 * 而本项目用文件约定式路由，路由 name 形如 `/system/user/`，组件名是 `SystemUser`，
 * 两边对不上时缓存会**静默失效**——页面照常能用，只剩"切回来状态没了"这一个症状。
 * 单测锁住 `usePageCache` 的契约
 * （`apps/web/src/layouts/__tests__/page-cache.spec.ts`），这里再把布局装配
 * （`apps/web/src/layouts/index.vue`）接到真实浏览器里跑一遍。
 *
 * 判定手法统一用"状态指纹"：在本页独有的搜索框里填一段文本，离开再回来，
 * 文本还在=命中缓存，文本没了=重新挂载。不读 store，避免测实现细节。
 */

/** 菜单里 keepAlive: true 的页面 */
const USER = {
  path: '/system/user',
  placeholder: '搜索用户名/昵称/邮箱/手机号',
};
const ROLE = {
  path: '/system/role',
  placeholder: '搜索角色名称/编码',
};
/** 菜单里没有 keepAlive 的页面，用作负对照 */
const ONLINE = {
  path: '/system/online',
  placeholder: '搜索用户名/昵称/IP地址',
};

const FINGERPRINT = 'keep-alive-fingerprint';

type PageSpec = typeof USER;

async function mark(page: Page, spec: PageSpec) {
  await searchBox(page, spec.placeholder).fill(FINGERPRINT);
}

test.describe('标签页页面缓存', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('切走再切回：缓存页保留输入状态', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, USER.path);
    await mark(page, USER);

    await switchAwayAndBack(page, ROLE.path, USER.path);

    await expect(searchBox(page, USER.placeholder)).toHaveValue(FINGERPRINT);
    // 回来时仍是同一个标签激活：说明没有走整页重载
    await expectActivePath(page, USER.path);
    expect(errors.errors).toEqual([]);
  });

  test('负对照：没开 keepAlive 的页面不缓存', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, ONLINE.path);
    await mark(page, ONLINE);

    await switchAwayAndBack(page, USER.path, ONLINE.path);

    await expect(searchBox(page, ONLINE.placeholder)).toHaveValue('');
    expect(errors.errors).toEqual([]);
  });

  test('两个缓存页各自独立，互不串状态', async ({ page }) => {
    await go(page, USER.path);
    await mark(page, USER);
    await go(page, ROLE.path);
    await searchBox(page, ROLE.placeholder).fill('role-only');

    await tab(page, USER.path).click();
    await expect(searchBox(page, USER.placeholder)).toHaveValue(FINGERPRINT);

    await tab(page, ROLE.path).click();
    await expect(searchBox(page, ROLE.placeholder)).toHaveValue('role-only');
  });

  test('右键「刷新当前」：推进缓存代号，状态被重建', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, USER.path);
    await mark(page, USER);

    await tab(page, USER.path).click({ button: 'right' });
    await page.getByRole('menuitem', { name: '刷新当前' }).click();

    // 刷新走 /redirect 中转；只有 invalidate 推进了代号，回来的才是新实例
    await expect(searchBox(page, USER.placeholder)).toHaveValue('', {
      timeout: 15_000,
    });
    await expectActivePath(page, USER.path);
    expect(errors.errors).toEqual([]);
  });

  test('关闭标签后再进：缓存被丢弃，拿到的是新实例', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, USER.path);
    await mark(page, USER);
    await go(page, ROLE.path);

    await tab(page, USER.path).locator('.tab-item__close').click();
    await expect(tab(page, USER.path)).toHaveCount(0);

    await go(page, USER.path);
    await expect(searchBox(page, USER.placeholder)).toHaveValue('');
    expect(errors.errors).toEqual([]);
  });

  test('退出登录不留残影：换账号进来是干净的页面', async ({ page }) => {
    await go(page, USER.path);
    await mark(page, USER);

    await page.getByTestId('logout-widget').click();
    // antd 会在两个汉字的按钮里补一个空格（ accessible name 是 "退 出"），所以用 \s* 容忍
    await page.getByRole('button', { name: /^退\s*出$/ }).click();

    // 退出后站内跳转会被守卫挡回登录页（此时 token 与缓存都已清）
    // 用 navigate 而不是 go：go 会断言目标标签被激活，而这里根本落不到首页
    await navigate(page, HOME_PATH);
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();

    await fillAccount(page);
    await submitLogin(page);
    await expectActivePath(page, HOME_PATH);

    await go(page, USER.path);
    await expect(searchBox(page, USER.placeholder)).toHaveValue('');
  });
});
