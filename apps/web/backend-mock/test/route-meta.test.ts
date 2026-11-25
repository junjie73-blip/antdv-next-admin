import { describe, expect, it } from 'vitest';

import {
  keyOf,
  methodOf,
  moduleOf,
  shouldInjectFailure,
  splitKey,
} from '../server/utils/route-meta';

describe('接口标识与分组', () => {
  it('keyOf 生成 `[METHOD]/path`，方法统一大写', () => {
    expect(keyOf('get', '/system/user/list')).toBe('[GET]/system/user/list');
    expect(keyOf('DELETE', '/system/user/:id')).toBe(
      '[DELETE]/system/user/:id',
    );
  });

  it('splitKey 是 keyOf 的逆运算', () => {
    const { method, path } = splitKey('[POST]/auth/login');
    expect(method).toBe('POST');
    expect(path).toBe('/auth/login');
    expect(keyOf(method, path)).toBe('[POST]/auth/login');
  });

  it('splitKey 容忍缺方法前缀与空路径', () => {
    expect(splitKey('/demo/list')).toEqual({
      method: 'GET',
      path: '/demo/list',
    });
    expect(splitKey('[GET]')).toEqual({ method: 'GET', path: '/' });
  });

  it('moduleOf 取前两段作为面板分组', () => {
    expect(moduleOf('/system/user/list')).toBe('system/user');
    expect(moduleOf('/system/dict/item')).toBe('system/dict');
    expect(moduleOf('/menus')).toBe('menus');
    expect(moduleOf('/demo/a/b/c')).toBe('demo/a');
    expect(moduleOf('/')).toBe('root');
  });

  it('methodOf 只接受 MOCK_METHODS，其余回落 GET', () => {
    expect(methodOf('put')).toBe('PUT');
    expect(methodOf('TRACE')).toBe('GET');
    expect(methodOf(undefined)).toBe('GET');
  });
});

describe('失败注入判定', () => {
  it('失败率 0 恒不注入，即使随机数为 0', () => {
    expect(shouldInjectFailure(0, () => 0)).toBe(false);
  });

  it('失败率 100 恒注入，即使随机数取上界', () => {
    expect(shouldInjectFailure(100, () => 0.999999)).toBe(true);
  });

  it('边界：随机数 * 100 等于失败率时不注入（严格小于）', () => {
    expect(shouldInjectFailure(30, () => 0.3)).toBe(false);
    expect(shouldInjectFailure(30, () => 0.299999)).toBe(true);
  });
});
