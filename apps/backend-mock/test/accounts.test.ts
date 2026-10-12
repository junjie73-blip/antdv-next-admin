import type { BackendMenu } from '@antdv/types';

import type { TestEvent } from './fixtures/nitro-imports';

import { describe, expect, it } from 'vitest';

import loginRoute from '../server/api/auth/login.post';
import userInfoRoute from '../server/api/auth/user-info.get';
import menusRoute, { menuTree } from '../server/api/menus.get';
import {
  accountOfHeaders,
  accountOfToken,
  accounts,
  authenticate,
  defaultAccount,
  issueToken,
  pickMenus,
  TOKEN_PREFIX,
} from '../server/utils/accounts';
import { createTestEvent } from './fixtures/nitro-imports';

/**
 * 双账号权限链路：登录 → token → 按 token 裁剪的菜单。
 *
 * 这条链是本项目的权限骨架（菜单即权限：前端把 `/menus` 的 name/path 摊成
 * allowedNames/allowedPaths，守卫按它判 403），所以任何一环静默失效都会表现为
 * "所有账号都是超管"。这里把三环分别钉住：凭据比对、token 反解、树裁剪，
 * 再用真实 handler 跑一遍端到端。
 */

type Handler = (event: TestEvent) => Promise<{
  code: number;
  data: null | { list: BackendMenu[] } | { user: Record<string, unknown> };
}>;

/** defineMockRoute 在测试替身下原样返回处理函数；类型上 h3 事件与 TestEvent 不同源，这里收口一次 */
const asHandler = (route: unknown) => route as Handler;

function flatten(list: BackendMenu[], acc: string[] = []): string[] {
  for (const menu of list) {
    if (menu.name) acc.push(menu.name);
    if (menu.children?.length) flatten(menu.children, acc);
  }
  return acc;
}

const ADMIN = accounts.find((account) => account.profile.username === 'admin')!;
const CUSTOM = accounts.find(
  (account) => account.profile.username === 'custom',
)!;

describe('mock 账号表', () => {
  it('每个账号都有唯一凭据，且 custom 不带任何通配', () => {
    const usernames = accounts.map((account) => account.profile.username);
    expect(new Set(usernames).size).toBe(usernames.length);

    expect(ADMIN.permissions).toContain('*');
    expect(CUSTOM.permissions.every((code) => code !== '*')).toBe(true);
    expect(CUSTOM.roles).toEqual(['custom']);
  });

  it('白名单里的菜单 name 必须真的存在于菜单树上（拼错就是静默少一个页面）', () => {
    const known = new Set(flatten(menuTree));
    expect(CUSTOM.visibleMenus?.filter((name) => !known.has(name))).toEqual([]);
  });

  it('按用户名+密码取账号，任一不符就不给身份', () => {
    expect(authenticate('admin', 'admin123')).toBe(ADMIN);
    expect(authenticate('custom', 'custom123')).toBe(CUSTOM);
    expect(authenticate('custom', 'admin123')).toBeUndefined();
    expect(authenticate('root', 'custom123')).toBeUndefined();
  });

  it('token 里编了身份，反解容忍 Bearer 前缀与大小写', () => {
    const token = issueToken(CUSTOM);
    expect(token.startsWith(`${TOKEN_PREFIX}custom_`)).toBe(true);
    expect(accountOfToken(token)).toBe(CUSTOM);
    expect(accountOfToken(`Bearer ${token}`)).toBe(CUSTOM);
    expect(accountOfToken('mock_token_nobody_1')).toBeUndefined();
    expect(accountOfToken(undefined)).toBeUndefined();
  });

  it('请求头按忽略大小写取 authorization', () => {
    const token = `Bearer ${issueToken(ADMIN)}`;
    expect(accountOfHeaders({ authorization: token })).toBe(ADMIN);
    expect(accountOfHeaders({ Authorization: token })).toBe(ADMIN);
    expect(accountOfHeaders({})).toBeUndefined();
  });
});

describe('pickMenus', () => {
  const tree: BackendMenu[] = [
    {
      menuName: '目录',
      name: 'Dir',
      children: [
        { menuName: '甲', name: 'A', path: '/dir/a' },
        { menuName: '乙', name: 'B', path: '/dir/b' },
      ],
    },
    { menuName: '孤儿', name: 'Lone', path: '/lone' },
  ];

  it('null 表示不裁剪', () => {
    expect(pickMenus(tree, null)).toBe(tree);
  });

  it('留叶、留还有孩子的父壳、空目录整条消失', () => {
    const picked = pickMenus(tree, ['A']);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.name).toBe('Dir');
    expect(picked[0]?.children?.map((child) => child.name)).toEqual(['A']);
  });

  it('一个都不剩时返回空数组，而不是把整棵树交出去', () => {
    expect(pickMenus(tree, ['NotThere'])).toEqual([]);
  });
});

describe('/auth/login', () => {
  const handler = asHandler(loginRoute);

  it('两个账号都能登录，token 能反解出自己', async () => {
    for (const account of accounts) {
      const res = await handler(
        event({
          body: {
            password: account.password,
            username: account.profile.username,
          },
        }),
      );
      expect(res.code).toBe(200);
      const user = (res.data as { user: Record<string, unknown> }).user;
      expect(user.username).toBe(account.profile.username);
      expect(accountOfToken(String(user.token))).toBe(account);
      expect(user.permissions).toEqual(account.permissions);
    }
  });

  it('密码错误：HTTP 仍 200，只有信封 code 非 200', async () => {
    const res = await handler(
      event({ body: { password: 'wrong', username: 'admin' } }),
    );
    expect(res.code).toBe(400);
    expect(res.data).toBeNull();
  });
});

describe('/auth/user-info 与 /menus 按 token 分账号', () => {
  const info = asHandler(userInfoRoute);
  const menus = asHandler(menusRoute);

  it('会话信息读的是 token 里那个人', async () => {
    for (const account of accounts) {
      const res = await info(event({ token: issueToken(account) }));
      const user = (res.data as { user: Record<string, unknown> }).user;
      expect(user.username).toBe(account.profile.username);
      expect(user.roles).toEqual(account.roles);
      // 会话接口不该把 token 回吐出去
      expect(user.token).toBeUndefined();
    }
  });

  it('admin 拿到整棵树，custom 只拿到白名单和存活的父壳', async () => {
    const full = await menus(event({ token: issueToken(ADMIN) }));
    expect(flatten((full.data as { list: BackendMenu[] }).list)).toEqual(
      flatten(menuTree),
    );

    const trimmed = await menus(event({ token: issueToken(CUSTOM) }));
    const names = flatten((trimmed.data as { list: BackendMenu[] }).list);
    // 多出来的只有父壳：目录本身不参与白名单，靠 surviving 的孩子留在树上；叶子必须一个不多
    expect(
      names.filter((name) => !CUSTOM.visibleMenus!.includes(name)),
    ).toEqual([
      'Dashboard',
      'SystemManage',
      'Demo',
      'DemoGalleryTable',
      'Account',
    ]);
    expect(names).not.toContain('SystemMenu');
    expect(names).not.toContain('ToolDict');
    expect(names).not.toContain('MonitorLog');
    expect(names).not.toContain('ScreenMonitor');
  });

  it('不带可识别 token 时回落默认账号，而不是报错', async () => {
    const res = await menus(event());
    expect(flatten((res.data as { list: BackendMenu[] }).list)).toEqual(
      flatten(menuTree),
    );
    expect(defaultAccount.profile.username).toBe('admin');
  });

  /**
   * 同一个 URL 现在会因 `Authorization` 给出不同内容，浏览器有权把上一个人的响应
   * 直接发给下一个人 —— 实测表现就是"用 custom 登录却拿到全量菜单"，看着像裁剪逻辑
   * 坏了，其实是命中缓存。`no-store` + `Vary` 两个都给出：前者禁用复用，后者说明原因。
   */
  it('按会话分数据的响应带上禁缓存头', async () => {
    for (const route of [menusRoute, userInfoRoute]) {
      const evt = event({ token: issueToken(CUSTOM) });
      await asHandler(route)(evt);
      expect(evt.resHeaders?.['cache-control']).toBe('no-store');
      expect(evt.resHeaders?.vary).toBe('Authorization');
    }
  });
});

/** 真实 fetcher 每个请求都带 `Bearer <token>`，这里按账号造事件 */
function event(init: { body?: unknown; token?: string } = {}): TestEvent {
  return createTestEvent({
    body: init.body,
    headers: init.token ? { authorization: `Bearer ${init.token}` } : {},
  });
}
