import { describe, expect, it } from 'vitest';

import {
  API_PREFIX,
  createMockProxy,
  createProxy,
  createServerProxy,
  MOCK_SERVER_PORT,
  resolveMockPort,
} from '../src/utils/proxy';

describe('createProxy', () => {
  it('按前缀建表，rewrite 去掉前缀', () => {
    const proxy = createProxy([['/api', 'http://127.0.0.1:3000']]);
    const rule = proxy['/api'];
    expect(rule?.target).toBe('http://127.0.0.1:3000');
    expect(rule?.changeOrigin).toBe(true);
    expect(rule?.ws).toBe(false);
    expect(rule?.rewrite('/api/user/list')).toBe('/user/list');
  });

  it('ws:// 目标自动开 websocket', () => {
    expect(createProxy([['/ws', 'ws://127.0.0.1:9000']])['/ws']?.ws).toBe(true);
  });

  it('https 目标关掉证书校验（自签内网服务）', () => {
    const rule = createProxy([['/sec', 'https://intranet.test']])['/sec'];
    expect(rule?.secure).toBe(false);
    expect(rule?.target).toBe('https://intranet.test');
  });

  it('不传列表时得到空表', () => {
    expect(createProxy()).toEqual({});
  });
});

describe('createMockProxy', () => {
  it('只有 VITE_MOCK 为 true 才生效（兼容字符串 env）', () => {
    expect(createMockProxy({ VITE_MOCK: 'false' })).toEqual({});
    expect(createMockProxy({})).toEqual({});
    expect(createMockProxy({ VITE_MOCK: true })).not.toEqual({});
    expect(createMockProxy({ VITE_MOCK: 'TRUE' })[API_PREFIX]).toBeDefined();
  });

  it('开关走 isEnvEnabled：数字 1 开启，字符串 "0" 不算开启', () => {
    // parseLoadedEnv 会把 '1' 转成数字 1、却把 '0' 留在字符串，
    // 用真值判断会误开代理（开了 /api 转发但 mock 服务没起）
    expect(createMockProxy({ VITE_MOCK: 1 })[API_PREFIX]).toBeDefined();
    expect(createMockProxy({ VITE_MOCK: '0' })).toEqual({});
    expect(createMockProxy({ VITE_MOCK: 'no' })).toEqual({});
  });

  it('默认转发到 Nitro 端口，且原样保留 /api 前缀', () => {
    const rule = createMockProxy({ VITE_MOCK: 'true' })[API_PREFIX];
    expect(rule?.target).toBe(`http://localhost:${MOCK_SERVER_PORT}`);
    expect(rule?.rewrite('/api/system/menu')).toBe('/api/system/menu');
  });

  it('VITE_MOCK_SERVER 可覆盖目标', () => {
    const rule = createMockProxy({
      VITE_MOCK: 'true',
      VITE_MOCK_SERVER: 'http://mock.internal:8080',
    })[API_PREFIX];
    expect(rule?.target).toBe('http://mock.internal:8080');
  });
});

describe('createServerProxy', () => {
  it('用户代理与 Mock 代理合并，同名前缀以 Mock 为准', () => {
    const proxy = createServerProxy({ VITE_MOCK: 'true' }, [
      ['/api', 'http://real-backend.test'],
      ['/upload', 'http://upload.test'],
    ]);

    expect(Object.keys(proxy).sort()).toEqual(['/api', '/upload']);
    expect(proxy['/api']?.target).toBe(`http://localhost:${MOCK_SERVER_PORT}`);
    expect(proxy['/upload']?.target).toBe('http://upload.test');
  });

  it('Mock 关掉时用户代理原样生效', () => {
    const proxy = createServerProxy({ VITE_MOCK: 'false' }, [
      ['/api', 'http://real-backend.test'],
    ]);
    expect(proxy['/api']?.target).toBe('http://real-backend.test');
    expect(proxy['/api']?.rewrite('/api/x')).toBe('/x');
  });
});

describe('resolveMockPort', () => {
  /**
   * REGRESSION：早期实现直接把 `Number(envConfig.VITE_MOCK_PORT)` 传给 nitro-mock 插件，
   * 而项目里并没有定义这个变量 —— NaN 一路走到 `server.listen(NaN)`，
   * dev server 启动即抛 ERR_SOCKET_BAD_PORT，整个前端起不来。
   */
  it('变量缺省时回落到默认端口，不能把 NaN 交出去', () => {
    expect(resolveMockPort({})).toBe(MOCK_SERVER_PORT);
    expect(resolveMockPort({ VITE_MOCK_PORT: undefined })).toBe(MOCK_SERVER_PORT);
    expect(resolveMockPort({ VITE_MOCK_PORT: 'abc' })).toBe(MOCK_SERVER_PORT);
  });

  it('VITE_MOCK_PORT 优先，且接受字符串数字', () => {
    expect(resolveMockPort({ VITE_MOCK_PORT: '6320' })).toBe(6320);
    expect(resolveMockPort({ VITE_MOCK_PORT: 6320 })).toBe(6320);
  });

  it('没写 VITE_MOCK_PORT 时从 VITE_MOCK_SERVER 取端口，代理与服务端口天然对齐', () => {
    expect(
      resolveMockPort({ VITE_MOCK_SERVER: 'http://localhost:5321' }),
    ).toBe(5321);
    // 只写主机不写端口 → 用默认值，而不是解析出 0 / NaN
    expect(resolveMockPort({ VITE_MOCK_SERVER: 'http://mock.internal' })).toBe(
      MOCK_SERVER_PORT,
    );
    // 非法 URL 不抛异常，直接回落
    expect(resolveMockPort({ VITE_MOCK_SERVER: 'not a url' })).toBe(
      MOCK_SERVER_PORT,
    );
  });

  it('越界端口视为无效，避免 listen 抛错', () => {
    expect(resolveMockPort({ VITE_MOCK_PORT: '0' })).toBe(MOCK_SERVER_PORT);
    expect(resolveMockPort({ VITE_MOCK_PORT: '70000' })).toBe(MOCK_SERVER_PORT);
  });
});
