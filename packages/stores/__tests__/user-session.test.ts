import type { BackendMenu } from '@antdv/types';

import { cache } from '@antdv/shared/cache';
import { createPinia, setActivePinia } from 'pinia';

import { useRouteStore } from '../src/route';
import { useTabsStore } from '../src/tabs';
import { useUserStore } from '../src/user';

/**
 * 会话的建立与还原：登录要作废上一个账号的派生授权，刷新要把密文凭证还原成可用 token。
 *
 * 两条都是"菜单即权限"下的越权 / 失效路径，而且都不体现在任何组件的渲染结果里：
 * - 直接打开登录页换账号（不先退出）时，路由 store 里还挂着旧账号的
 *   `allowedNames/allowedPaths` 与 `isLoaded === true`，守卫因此跳过重新拉菜单，
 *   新账号拿着别人的授权集 —— 权限变小是 403 错乱，权限变大就是越权。
 * - `setToken` 落盘的是 JWE 密文，刷新后 store 只能同步读到密文；不解密就把
 *   `Bearer <密文>` 发出去，后端认不出，表现为"每次刷新都要重登"。
 */

const TOKEN_KEY = 'auth_token';

const MENU: BackendMenu[] = [
  {
    children: [
      { menuName: '用户管理', name: 'SystemUser', path: '/system/user' },
    ],
    menuName: '系统管理',
    name: 'System',
    path: '/system',
  },
];

const post = vi.hoisted(() => vi.fn());

vi.mock('@antdv/request', () => ({
  http: { Post: post },
}));

/** 上一次登录留下的完整会话态：凭证 + 由它推导出来的菜单、授权集与标签页 */
function seedPreviousSession() {
  setActivePinia(createPinia());
  const user = useUserStore();
  const route = useRouteStore();
  const tabs = useTabsStore();

  user.token = 'mock_token_admin_1';
  user.userInfo = {
    avatar: '',
    email: '',
    id: 1,
    nickname: '管理员',
    permissions: ['*'],
    phone: '',
    roles: ['admin'],
    username: 'admin',
  } as never;

  route.backendMenus = MENU;
  route.menus = MENU as never;
  route.allowedNames = new Set(['System', 'SystemUser']);
  route.allowedPaths = new Set(['/system/user']);
  route.isLoaded = true;

  tabs.tabs = [
    {
      closable: true,
      key: '/system/user',
      path: '/system/user',
      title: '用户管理',
    },
  ] as never;

  return { route, tabs, user };
}

function loginAs(username: string, permissions: string[], roles: string[]) {
  post.mockResolvedValueOnce({
    code: 200,
    data: {
      user: {
        id: 2,
        nickname: '演示用户',
        password: 'x',
        permissions,
        roles,
        token: `mock_token_${username}_2`,
        username,
      },
    },
    message: '登录成功',
  });
}

describe('useUserStore.login —— 换账号时作废旧授权', () => {
  it('登录成功后旧账号的授权集与标签页都不在了', async () => {
    const { route, tabs, user } = seedPreviousSession();
    loginAs('custom', ['system:user:list'], ['custom']);

    await user.login('custom', 'custom123');

    expect(user.token).toBe('mock_token_custom_2');
    expect(route.isLoaded).toBe(false);
    expect([...route.allowedNames]).toEqual([]);
    expect([...route.allowedPaths]).toEqual([]);
    expect(tabs.tabs).toEqual([]);
  });

  it("新账号的权限码原样入库，不再兜底成 admin / '*'", async () => {
    const { user } = seedPreviousSession();
    loginAs('custom', ['system:user:list'], ['custom']);

    await user.login('custom', 'custom123');

    expect(user.permissions).toEqual(['system:user:list']);
    expect(user.roles).toEqual(['custom']);
    expect(user.hasPermission('system:menu:list')).toBe(false);
  });

  it('接口没给权限字段时当作没有权限，而不是升成超管', async () => {
    const { user } = seedPreviousSession();
    post.mockResolvedValueOnce({
      code: 200,
      data: { user: { id: 2, token: 't', username: 'custom' } },
      message: '登录成功',
    });

    await user.login('custom', 'custom123');

    expect(user.permissions).toEqual([]);
    expect(user.roles).toEqual([]);
    expect(user.hasPermission('system:user:list')).toBe(false);
  });

  it('登录失败不动现有会话（免得一次输错就把人踢出去）', async () => {
    const { route, user } = seedPreviousSession();
    post.mockResolvedValueOnce({ code: 400, data: null, message: '密码错误' });

    const result = await user.login('custom', 'wrong');

    expect(result.success).toBe(false);
    expect(user.token).toBe('mock_token_admin_1');
    expect(route.isLoaded).toBe(true);
    expect([...route.allowedNames]).toContain('SystemUser');
  });
});

describe('useUserStore —— 凭证的存储与还原', () => {
  it('落盘的是密文，内存里的是能当凭证用的明文', async () => {
    setActivePinia(createPinia());
    const user = useUserStore();
    loginAs('custom', [], ['custom']);

    await user.login('custom', 'custom123');

    const stored = cache.getItem(TOKEN_KEY) as string;
    expect(stored).not.toContain('mock_token_custom_2');
    // JWE 的 protected header 里能看到算法，比数点数靠谱（dir+A256GCM 是 5 段）
    expect(
      JSON.parse(
        Buffer.from(stored.split('.')[0] ?? '', 'base64url').toString(),
      ),
    ).toEqual(expect.objectContaining({ alg: 'dir', enc: 'A256GCM' }));
    expect(user.token).toBe('mock_token_custom_2');
  });

  it('initToken 把缓存里的密文还原成可用 token（刷新后不用重登）', async () => {
    setActivePinia(createPinia());
    const first = useUserStore();
    loginAs('custom', [], ['custom']);
    await first.login('custom', 'custom123');

    // 模拟整页刷新：换一个新 store，只能从缓存同步读到密文
    setActivePinia(createPinia());
    const rehydrated = useUserStore();
    expect(rehydrated.token).not.toBe('mock_token_custom_2');

    await rehydrated.initToken();
    expect(rehydrated.token).toBe('mock_token_custom_2');
    expect(rehydrated.isLoggedIn).toBe(true);
  });

  it('旧版本留下的明文 token 照样能用（向后兼容）', async () => {
    setActivePinia(createPinia());
    cache.setItem(TOKEN_KEY, 'plain-legacy-token');
    const user = useUserStore();

    await user.initToken();

    expect(user.token).toBe('plain-legacy-token');
  });

  it('解不开的密文就当没登录，而不是带着必然 401 的凭证继续跑', async () => {
    setActivePinia(createPinia());
    // 三段式但签名不对（设备指纹变了、值被改过）
    cache.setItem(TOKEN_KEY, 'eyJhbGciOiJkaXIifQ.eyJkYXRhIjoieSJ0.badsign');
    const user = useUserStore();

    await user.initToken();

    expect(user.isLoggedIn).toBe(false);
  });

  it('退出后缓存里不再留凭证', async () => {
    setActivePinia(createPinia());
    const user = useUserStore();
    loginAs('custom', [], ['custom']);
    await user.login('custom', 'custom123');

    user.logout();

    expect(cache.getItem(TOKEN_KEY)).toBeNull();
    await user.initToken();
    expect(user.isLoggedIn).toBe(false);
  });
});
