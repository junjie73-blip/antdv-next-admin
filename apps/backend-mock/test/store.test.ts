import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearObservability,
  getStore,
  LOG_LIMIT,
  patchGlobal,
  patchRouteRuntime,
  persist,
  pushLog,
  recordHit,
  registerGenerated,
  registerManifest,
  resetStore,
  resolveRuntime,
  setPersistFile,
  unregisterGenerated,
} from '../server/utils/store';

const TMP_DIR = join(process.cwd(), 'test', '.tmp-store');
const STATE_FILE = join(TMP_DIR, 'state.json');

function manifestItem(key: string, module: string) {
  return {
    duplicates: [] as string[],
    key,
    method: 'GET' as const,
    module,
    path: key.replace(/^\[[A-Z]+\]/, ''),
    source: 'source' as const,
  };
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  rmSync(STATE_FILE, { force: true });
  setPersistFile(STATE_FILE);
  resetStore();
});

afterEach(() => {
  resetStore();
  rmSync(TMP_DIR, { force: true, recursive: true });
});

describe('运行时配置解析', () => {
  it('未覆盖时回落到全局默认', () => {
    patchGlobal({ defaultDelay: 120, failRate: 30 });
    expect(resolveRuntime('[GET]/a')).toEqual({
      delay: 120,
      disabled: false,
      failRate: 30,
      forcedStatus: undefined,
      globalEnabled: true,
    });
  });

  it('单接口覆盖优先于全局', () => {
    patchGlobal({ defaultDelay: 120, failRate: 30 });
    patchRouteRuntime('[GET]/a', {
      delay: 0,
      disabled: true,
      failRate: 100,
      status: 503,
    });
    expect(resolveRuntime('[GET]/a')).toEqual({
      delay: 0,
      disabled: true,
      failRate: 100,
      forcedStatus: 503,
      globalEnabled: true,
    });
  });

  it('总开关关闭时 globalEnabled 为 false', () => {
    patchGlobal({ enabled: false });
    expect(resolveRuntime('[GET]/a').globalEnabled).toBe(false);
  });

  it('"启用"与传 undefined 都不算覆盖，覆盖清空后回落全局', () => {
    patchGlobal({ failRate: 25 });
    patchRouteRuntime('[GET]/a', { failRate: 80 });
    expect(getStore().routes['[GET]/a']).toEqual({ failRate: 80 });

    patchRouteRuntime('[GET]/a', { failRate: undefined });
    expect(getStore().routes['[GET]/a']).toBeUndefined();
    expect(resolveRuntime('[GET]/a').failRate).toBe(25);

    patchRouteRuntime('[GET]/a', { disabled: true });
    patchRouteRuntime('[GET]/a', { disabled: false });
    expect(getStore().routes['[GET]/a']).toBeUndefined();
  });
});

describe('接口清单注册', () => {
  it('同 key 不同模块只登记一次，其余进 duplicates', () => {
    registerManifest([
      manifestItem('[GET]/system/user/options', 'system/role'),
    ]);
    registerManifest([
      manifestItem('[GET]/system/user/options', 'system/user'),
    ]);

    const item = getStore().manifest['[GET]/system/user/options']!;
    expect(item.module).toBe('system/role');
    expect(item.duplicates).toEqual(['system/user']);
  });

  it('生成接口覆盖同名条目，保留原 duplicates', () => {
    registerManifest([manifestItem('[GET]/demo/a', 'demo')]);
    registerManifest([manifestItem('[GET]/demo/a', 'other')]);
    registerGenerated([
      { id: 'demo-a', key: '[GET]/demo/a', template: { 'x|1-3': 1 } },
    ]);
    registerManifest([
      {
        ...manifestItem('[GET]/demo/a', 'demo'),
        file: 'mock/generated/demo-a.fake.ts',
        source: 'generated',
        title: '演示 A',
      },
    ]);

    const item = getStore().manifest['[GET]/demo/a']!;
    expect(item.source).toBe('generated');
    expect(item.title).toBe('演示 A');
    expect(item.duplicates).toEqual(['other']);
  });

  it('删除生成接口连带清掉覆盖、统计与清单', () => {
    registerManifest([manifestItem('[GET]/demo/b', 'demo')]);
    registerGenerated([{ id: 'demo-b', key: '[GET]/demo/b', template: {} }]);
    patchRouteRuntime('[GET]/demo/b', { delay: 50 });
    recordHit('[GET]/demo/b', 10, 200);

    const removed = unregisterGenerated('demo-b');
    expect(removed?.key).toBe('[GET]/demo/b');
    expect(getStore().manifest['[GET]/demo/b']).toBeUndefined();
    expect(getStore().routes['[GET]/demo/b']).toBeUndefined();
    expect(getStore().stats['[GET]/demo/b']).toBeUndefined();
    expect(unregisterGenerated('demo-b')).toBeUndefined();
  });
});

describe('命中统计与日志', () => {
  it('recordHit 累计次数、均值并按状态码计错误', () => {
    recordHit('[GET]/a', 10, 200);
    recordHit('[GET]/a', 30, 500);
    const stat = getStore().stats['[GET]/a']!;
    expect(stat.count).toBe(2);
    expect(stat.avgMs).toBe(20);
    expect(stat.errors).toBe(1);
  });

  it('日志按最新在前并限制在 LOG_LIMIT 条内', () => {
    for (let index = 0; index < LOG_LIMIT + 20; index++) {
      pushLog({
        code: 200,
        injected: false,
        key: '[GET]/a',
        method: 'GET',
        module: 'a',
        ms: 1,
        path: '/a',
        skipped: false,
        status: 200,
      });
    }
    const logs = getStore().logs;
    expect(logs).toHaveLength(LOG_LIMIT);
    expect(logs[0]!.id).toBe(LOG_LIMIT + 20);
    expect(logs[logs.length - 1]!.id).toBe(21);
  });

  it('清空观测数据不动运行时配置', () => {
    patchGlobal({ failRate: 10 });
    recordHit('[GET]/a', 5, 500);
    pushLog({
      code: 500,
      injected: true,
      key: '[GET]/a',
      method: 'GET',
      module: 'a',
      ms: 5,
      path: '/a',
      skipped: false,
      status: 500,
    });
    clearObservability();
    expect(getStore().logs).toEqual([]);
    expect(getStore().stats).toEqual({});
    expect(getStore().global.failRate).toBe(10);
  });
});

describe('持久化', () => {
  it('只落盘开关、单接口覆盖与生成接口定义', () => {
    patchGlobal({ defaultDelay: 500, enabled: false });
    patchRouteRuntime('[GET]/a', { delay: 20 });
    registerGenerated([{ id: 'x', key: '[GET]/demo/x', template: { a: 1 } }]);
    recordHit('[GET]/a', 20, 200);
    persist(getStore());

    const raw = JSON.parse(readState()) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['generated', 'global', 'routes']);
    expect(raw.global).toEqual({
      defaultDelay: 500,
      enabled: false,
      failRate: 0,
    });

    resetStore();
    expect(getStore().global.enabled).toBe(false);
    expect(resolveRuntime('[GET]/a').delay).toBe(20);
    expect(getStore().stats).toEqual({});
  });

  it('状态文件损坏时回落默认值而不是崩溃', () => {
    writeFileSync(STATE_FILE, '{ not json', 'utf8');
    resetStore();
    expect(getStore().global).toEqual({
      defaultDelay: 0,
      enabled: true,
      failRate: 0,
    });
  });
});

function readState(): string {
  return readFileSync(STATE_FILE, 'utf8');
}
