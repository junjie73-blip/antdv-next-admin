import { beforeEach, describe, expect, it } from 'vitest';

import {
  configureSharedEnv,
  getCachePrefix,
  getMinioPublicUrl,
  isEnvEnabled,
  isProduction,
} from '../src/env';

describe('configureSharedEnv', () => {
  beforeEach(() => {
    configureSharedEnv({
      cachePrefix: 'app_cache',
      minioPublicUrl: undefined,
      production: false,
    });
  });

  it('只覆盖传入的键，其余保持原值', () => {
    configureSharedEnv({ production: true });
    expect(isProduction()).toBe(true);
    expect(getCachePrefix()).toBe('app_cache');
  });

  it('空串前缀也要能落进去，由调用方决定是否回退', () => {
    configureSharedEnv({ cachePrefix: '' });
    expect(getCachePrefix()).toBe('');
  });

  it('minioPublicUrl 未配置时返回 undefined，下载走代理前缀', () => {
    expect(getMinioPublicUrl()).toBeUndefined();
    configureSharedEnv({ minioPublicUrl: 'http://minio.local:9000' });
    expect(getMinioPublicUrl()).toBe('http://minio.local:9000');
  });
});

/**
 * 起因：`apps/web` 里写过 `enabled: import.meta.env.VITE_MICRO_APP === true`。
 * Vite 的 env 值全是字符串，`'true' === true` 恒为 false，于是整个微前端模块
 * "配置了开关也永远不生效"，页面上还显示成正常状态 —— 这类静默失效必须用测试堵住。
 */
describe('isEnvEnabled', () => {
  it('认字符串形式的真值，忽略大小写与空格', () => {
    for (const raw of ['true', 'TRUE', ' true ', '1', 'on', 'ON', 'yes']) {
      expect(isEnvEnabled(raw)).toBe(true);
    }
  });

  it('其余一律为假：未定义、空串、false、乱填都不能当成开启', () => {
    for (const raw of [undefined, '', 'false', '0', 'no', 'null', 'undefined']) {
      expect(isEnvEnabled(raw)).toBe(false);
    }
  });

  it('已经是布尔值时直接采信，非字符串/布尔不是开关', () => {
    expect(isEnvEnabled(true)).toBe(true);
    expect(isEnvEnabled(false)).toBe(false);
    expect(isEnvEnabled(1)).toBe(false);
    expect(isEnvEnabled(null)).toBe(false);
  });
});
