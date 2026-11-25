import { describe, expect, it } from 'vitest';

import { createProxy, createServerProxy } from '../src/utils/proxy';

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

describe('createServerProxy', () => {
  it('只返回用户配置的代理，不再隐式注入 mock 代理', () => {
    const proxy = createServerProxy(
      { VITE_MOCK: 'true', VITE_MOCK_SERVER: 'http://localhost:5320' },
      [
        ['/api', 'http://real-backend.test'],
        ['/upload', 'http://upload.test'],
      ],
    );

    expect(Object.keys(proxy).sort()).toEqual(['/api', '/upload']);
    expect(proxy['/api']?.target).toBe('http://real-backend.test');
    expect(proxy['/api']?.rewrite('/api/x')).toBe('/x');
    expect(proxy['/upload']?.target).toBe('http://upload.test');
  });

  it('没有用户代理时为空表，避免抢占 Nitro 官方插件的 /api', () => {
    expect(createServerProxy({ VITE_MOCK: true })).toEqual({});
  });
});
