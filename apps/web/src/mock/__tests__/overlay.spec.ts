import type { FixtureRoute, FixtureSet, MockReply } from '../types';

import { beforeEach, describe, expect, it } from 'vitest';

import { matchRoute, normalizeRequest } from '../matcher';
import { createOverlay } from '../overlay';

/**
 * 写覆盖层要保证的是「一次会话内部自洽」：新增完再查列表能看到，登录完取用户信息
 * 拿到的是登录的那个人。响应信封的形状必须和 Nitro 的 `envelope()` 逐字段一致，
 * 否则前端 `api/request.ts` 的 `res.data` 解包会拿到 undefined。
 */

const USERS = Array.from({ length: 12 }, (_, index) => ({
  createdAt: `2026-01-0${(index % 9) + 1} 10:00:00`,
  id: index + 1,
  nickname: `用户${index + 1}`,
  updatedAt: `2026-01-0${(index % 9) + 1} 10:00:00`,
  username: `user${index + 1}`,
}));

function makeFixtures(): FixtureSet {
  const withRoute = (
    extra: Partial<FixtureRoute>,
    method: FixtureRoute['method'],
    path: string,
  ): FixtureRoute => ({ method, path, ...extra });

  return {
    auth: {
      accounts: [
        {
          password: 'admin123',
          permissions: ['*'],
          profile: {
            id: '1',
            nickname: '管理员',
            username: 'admin',
          },
          roles: ['admin'],
          username: 'admin',
          visibleMenus: null,
        },
        {
          password: 'custom123',
          permissions: ['system:user:list'],
          profile: {
            id: '2',
            nickname: '演示用户',
            username: 'custom',
          },
          roles: ['custom'],
          username: 'custom',
          visibleMenus: ['Analysis'],
        },
      ],
      failure: { code: 400, data: null, message: '用户名或密码错误' },
      loginPath: '/auth/login',
      logoutPath: '/auth/logout',
      success: {
        code: 200,
        data: {
          user: {
            id: '1',
            nickname: '管理员',
            permissions: ['*'],
            roles: ['admin'],
            token: 'mock_token_0',
            username: 'admin',
          },
        },
        message: '登录成功',
      },
      userPath: '/auth/user-info',
    },
    generatedAt: '2026-01-01T00:00:00.000Z',
    menusPath: '/menus',
    mockServer: 'http://localhost:5320',
    routes: [
      withRoute(
        {
          collection: '/system/user',
          listField: 'list',
          response: {
            code: 200,
            data: { list: structuredClone(USERS), total: USERS.length },
            message: '获取用户列表成功',
          },
          totalField: 'total',
        },
        'GET',
        '/system/user/list',
      ),
      withRoute(
        {
          collection: '/system/user',
          response: { code: 200, data: null, message: '获取用户详情成功' },
        },
        'GET',
        '/system/user/:id',
      ),
      withRoute({ collection: '/system/user' }, 'POST', '/system/user'),
      withRoute({ collection: '/system/user' }, 'PUT', '/system/user/:id'),
      withRoute({ collection: '/system/user' }, 'DELETE', '/system/user/:id'),
      withRoute(
        {
          collection: '/menus',
          response: {
            code: 200,
            data: {
              list: [
                {
                  children: [
                    { menuName: '分析面板', name: 'Analysis' },
                    { menuName: '实时监控大屏', name: 'ScreenMonitor' },
                  ],
                  menuName: '仪表盘',
                  name: 'Dashboard',
                },
                {
                  children: [{ menuName: '用户管理', name: 'SystemUser' }],
                  menuName: '系统管理',
                  name: 'SystemManage',
                },
              ],
            },
            message: '获取菜单成功',
          },
        },
        'GET',
        '/menus',
      ),
      withRoute(
        {
          response: {
            code: 200,
            data: {
              user: {
                id: '1',
                permissions: ['*'],
                roles: ['admin'],
                username: 'admin',
              },
            },
            message: '获取用户信息成功',
          },
        },
        'GET',
        '/auth/user-info',
      ),
      withRoute({ collection: '/auth/login' }, 'POST', '/auth/login'),
      withRoute({ collection: '/auth/logout' }, 'POST', '/auth/logout'),
      // 带动词后缀、不属于任何集合根的写接口：应答成功，不碰内存
      withRoute(
        { collection: '/system/notice/read' },
        'PUT',
        '/system/notice/read/:id',
      ),
    ],
  };
}

const fixtures = makeFixtures();
let overlay: ReturnType<typeof createOverlay>;

function handle(url: string, init: RequestInit = {}): MockReply | null {
  const request = normalizeRequest(url, init, {
    baseUrl: 'http://localhost:9080/',
    prefix: '',
  });
  if (!request) throw new Error(`归一化失败：${url}`);
  const matched = matchRoute(fixtures.routes, request.method, request.path);
  if (!matched)
    throw new Error(`未命中接口：${request.method} ${request.path}`);
  return overlay.handle(matched.route, request, matched.params);
}

function jsonOf(reply: MockReply | null): any {
  if (!reply) throw new Error('覆盖层没有应答');
  return reply.body;
}

beforeEach(() => {
  overlay = createOverlay(makeFixtures());
});

describe('信封形状', () => {
  it('读接口的字段与顺序都是 code/data/message', () => {
    const reply = handle('/menus');
    expect(reply?.status).toBe(200);
    expect(Object.keys(jsonOf(reply))).toEqual(['code', 'data', 'message']);
  });

  it('应答是克隆体，调用方改数据不会污染会话状态', () => {
    const body = jsonOf(handle('/menus'));
    body.data.list.push({ menuName: '脏数据', name: 'Dirty' });
    expect(jsonOf(handle('/menus')).data.list).toHaveLength(2);
  });

  it('写接口的应答同样是三字段信封', () => {
    const body = jsonOf(
      handle('/system/user', {
        body: JSON.stringify({ nickname: '新用户', username: 'fresh' }),
        method: 'POST',
      }),
    );
    expect(Object.keys(body)).toEqual(['code', 'data', 'message']);
    expect(body.code).toBe(200);
  });
});

describe('集合的写覆盖', () => {
  it('列表读按查询串分页，total 是集合全量', () => {
    const first = jsonOf(handle('/system/user/list?pageNum=1&pageSize=5'));
    expect(first.data.list).toHaveLength(5);
    expect(first.data.total).toBe(12);

    const second = jsonOf(handle('/system/user/list?page=2&pageSize=5'));
    expect(second.data.list.map((item: any) => item.id)).toEqual([
      6, 7, 8, 9, 10,
    ]);
  });

  it('新增后列表能查到，id 与时间戳自动补齐', () => {
    const created = jsonOf(
      handle('/system/user', {
        body: JSON.stringify({ nickname: '张三', username: 'zhangsan' }),
        method: 'POST',
      }),
    );
    expect(created.data.id).toBe(13);
    expect(created.data.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );

    const list = jsonOf(handle('/system/user/list?pageSize=100'));
    expect(list.data.total).toBe(13);
    expect(
      list.data.list.some((item: any) => item.username === 'zhangsan'),
    ).toBe(true);
  });

  it('改完能从详情接口读到，删完从列表里消失', () => {
    handle('/system/user/2', {
      body: JSON.stringify({ nickname: '改过名字' }),
      method: 'PUT',
    });
    expect(jsonOf(handle('/system/user/2')).data.nickname).toBe('改过名字');

    handle('/system/user/3', { method: 'DELETE' });
    const list = jsonOf(handle('/system/user/list?pageSize=100'));
    expect(list.data.total).toBe(11);
    expect(list.data.list.some((item: any) => item.id === 3)).toBe(false);
  });

  it('不属于任何集合的写接口返回成功但不改动内存', () => {
    expect(jsonOf(handle('/system/notice/read/1', { method: 'PUT' }))).toEqual({
      code: 200,
      data: null,
      message: 'ok',
    });
  });
});

describe('列表筛选', () => {
  // 生产产物里搜索框一度是"输什么都一样"：覆盖层只处理分页、把查询条件全丢了，
  // 新增完按关键词搜也搜不到（用例在浏览器里看到的是列表第一页）。
  it('keyword 走不区分大小写的子串匹配，total 是筛选后的条数', () => {
    const body = jsonOf(handle('/system/user/list?keyword=USER1&pageSize=100'));
    expect(body.data.total).toBe(4);
    expect(body.data.list.map((item: any) => item.username)).toEqual([
      'user1',
      'user10',
      'user11',
      'user12',
    ]);
  });

  it('非关键词的查询键走等值，user1 不会捞到 user10', () => {
    const body = jsonOf(handle('/system/user/list?username=user1'));
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].id).toBe(1);
  });

  it('不是记录字段的查询键（排序、时间范围）不参与筛选，别把表格筛成空的', () => {
    const body = jsonOf(
      handle('/system/user/list?sort=desc&order=asc&dateRange=2026-01-01'),
    );
    expect(body.data.total).toBe(12);
  });

  it('筛选后再分页：第二页拿的是筛选结果的第 3、4 条', () => {
    const body = jsonOf(
      handle('/system/user/list?keyword=user1&page=2&pageSize=2'),
    );
    expect(body.data.list.map((item: any) => item.username)).toEqual([
      'user11',
      'user12',
    ]);
    expect(body.data.total).toBe(4);
  });

  it('新增的行能被关键词搜到（写覆盖与筛选用的是同一份内存）', () => {
    handle('/system/user', {
      body: JSON.stringify({
        nickname: '巡检新增',
        username: 'prodprobe',
      }),
      method: 'POST',
    });
    const body = jsonOf(handle('/system/user/list?keyword=prodprobe'));
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].username).toBe('prodprobe');
  });
});

describe('登录会话', () => {
  it('登录成功后用户信息读的是会话里的人，且不回传 token', () => {
    const login = jsonOf(
      handle('/auth/login', {
        body: JSON.stringify({ password: 'admin123', username: 'admin' }),
        method: 'POST',
      }),
    );
    expect(login.data.user.token).not.toBe('mock_token_0');
    expect(login.message).toBe('登录成功');

    const info = jsonOf(handle('/auth/user-info'));
    expect(info.data.user.username).toBe('admin');
    expect(info.data.user.nickname).toBe('管理员');
    expect(info.data.user.token).toBeUndefined();
  });

  it('两个账号都能登录，token 里带上身份', () => {
    for (const [username, password] of [
      ['admin', 'admin123'],
      ['custom', 'custom123'],
    ]) {
      const login = jsonOf(
        handle('/auth/login', {
          body: JSON.stringify({ password, username }),
          method: 'POST',
        }),
      );
      expect(login.data.user.username).toBe(username);
      expect(login.data.user.token).toContain(`mock_token_${username}_`);
      expect(jsonOf(handle('/auth/user-info')).data.user.username).toBe(
        username,
      );
    }
  });

  it('菜单按会话账号裁剪：custom 只拿到白名单和还有孩子的父壳', () => {
    handle('/auth/login', {
      body: JSON.stringify({ password: 'custom123', username: 'custom' }),
      method: 'POST',
    });
    const list = jsonOf(handle('/menus')).data.list;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Dashboard');
    expect(list[0].children.map((item: any) => item.name)).toEqual([
      'Analysis',
    ]);
  });

  it('未登录时给全量菜单（和 Nitro 回落默认账号一致）', () => {
    expect(jsonOf(handle('/menus')).data.list).toHaveLength(2);
  });

  it('登出后菜单又回到全量，不留上一个账号的裁剪结果', () => {
    handle('/auth/login', {
      body: JSON.stringify({ password: 'custom123', username: 'custom' }),
      method: 'POST',
    });
    handle('/auth/logout', { method: 'POST' });
    expect(jsonOf(handle('/menus')).data.list).toHaveLength(2);
  });

  it('密码错误回到 Nitro 的 bizError 形状：HTTP 200 + code 400', () => {
    const reply = handle('/auth/login', {
      body: JSON.stringify({ password: 'nope', username: 'admin' }),
      method: 'POST',
    });
    expect(reply?.status).toBe(200);
    expect(jsonOf(reply)).toEqual({
      code: 400,
      data: null,
      message: '用户名或密码错误',
    });
  });

  it('账号存在但密码属于别人：同样判失败', () => {
    const reply = handle('/auth/login', {
      body: JSON.stringify({ password: 'admin123', username: 'custom' }),
      method: 'POST',
    });
    expect(jsonOf(reply).code).toBe(400);
  });

  it('登出后会话清空，用户信息回到快照本身', () => {
    handle('/auth/login', {
      body: JSON.stringify({ password: 'admin123', username: 'admin' }),
      method: 'POST',
    });
    handle('/auth/logout', { method: 'POST' });
    expect(jsonOf(handle('/auth/user-info')).data.user.username).toBe('admin');
    expect(
      jsonOf(handle('/auth/user-info')).data.user.nickname,
    ).toBeUndefined();
  });
});
