/**
 * 运行环境判定与生产保护的纯逻辑测试。
 *
 * 覆盖：MOCK_ENV/NODE_ENV 优先级、dev/prod 分库文件名、是否播种、
 * 生产控制面拦截清单。不依赖 Nitro 运行时与真实数据库。
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  dbFileName,
  DEV_DB_NAME,
  getMockEnv,
  isProduction,
  PROD_DB_NAME,
  shouldSeedBuiltinData,
} from '../server/utils/db/sqlite/env';
import { guardProdOp, isProdBlockedOp } from '../server/utils/prod-guard';

function clearEnv(): void {
  delete process.env.MOCK_ENV;
  delete process.env.NODE_ENV;
}

afterEach(clearEnv);

describe('运行环境判定', () => {
  it('无环境变量时默认 development', () => {
    clearEnv();
    expect(getMockEnv()).toBe('development');
    expect(isProduction()).toBe(false);
    expect(shouldSeedBuiltinData()).toBe(true);
    expect(dbFileName()).toBe(DEV_DB_NAME);
  });

  it('MOCK_ENV 优先于 NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    process.env.MOCK_ENV = 'development';
    expect(getMockEnv()).toBe('development');
    expect(isProduction()).toBe(false);
  });

  it('production 用独立库文件且不播种', () => {
    process.env.MOCK_ENV = 'production';
    expect(getMockEnv()).toBe('production');
    expect(isProduction()).toBe(true);
    expect(shouldSeedBuiltinData()).toBe(false);
    expect(dbFileName()).toBe(PROD_DB_NAME);
    expect(dbFileName()).not.toBe(DEV_DB_NAME);
  });

  it('NODE_ENV=production 也能判定（未设 MOCK_ENV 时）', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
  });

  it('test 环境播种、用开发库', () => {
    process.env.MOCK_ENV = 'test';
    expect(getMockEnv()).toBe('test');
    expect(shouldSeedBuiltinData()).toBe(true);
    expect(dbFileName()).toBe(DEV_DB_NAME);
  });
});

describe('生产环境保护', () => {
  it('开发环境放行所有运维接口', () => {
    clearEnv();
    expect(guardProdOp('POST', '/api/mock-center/runtime')).toBeNull();
    expect(guardProdOp('PUT', '/api/system/config/reset')).toBeNull();
  });

  it('生产环境拦截重置 / 控制面写接口（返回 403 信封）', () => {
    process.env.MOCK_ENV = 'production';
    for (const [method, path] of [
      ['POST', '/api/mock-center/runtime'],
      ['POST', '/api/mock-center/route-runtime'],
      ['POST', '/api/mock-center/logs/clear'],
      ['POST', '/api/mock-center/routes/save'],
      ['POST', '/api/mock-center/routes/remove'],
      ['PUT', '/api/system/config/reset'],
    ] as const) {
      const result = guardProdOp(method, path);
      expect(result?.code).toBe(403);
      expect(result?.message).toContain('生产环境');
    }
  });

  it('生产环境放行普通业务接口与只读接口', () => {
    process.env.MOCK_ENV = 'production';
    expect(isProdBlockedOp('GET', '/api/mock-center/overview')).toBe(false);
    expect(guardProdOp('GET', '/api/system/user/list')).toBeNull();
    expect(guardProdOp('POST', '/api/system/user/save')).toBeNull();
  });

  it('大小写不敏感的路径匹配', () => {
    expect(isProdBlockedOp('post', '/api/mock-center/runtime')).toBe(true);
  });
});
