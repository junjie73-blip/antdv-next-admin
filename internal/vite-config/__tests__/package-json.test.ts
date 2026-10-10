import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createAppInfo,
  readPackageJson,
  resolveLibExternals,
} from '../src/utils/package-json';

function fixture(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'vite-config-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(content), 'utf8');
  return dir;
}

describe('readPackageJson', () => {
  it('读消费方目录的 package.json', () => {
    const dir = fixture({ dependencies: { vue: '^3.5.0' }, name: 'demo' });
    expect(readPackageJson(dir).name).toBe('demo');
  });

  it('文件不存在时返回空对象而不是抛错（元信息缺失不该让构建挂）', () => {
    expect(readPackageJson(join(tmpdir(), 'definitely-not-here-42'))).toEqual(
      {},
    );
  });
});

describe('createAppInfo', () => {
  it('产出 __APP_INFO__ 需要的 pkg 摘要与构建时间', () => {
    const dir = fixture({
      dependencies: { vue: '^3.5.0' },
      devDependencies: { vite: '^8.0.0' },
      name: 'demo',
      version: '1.2.3',
    });

    const info = createAppInfo(dir, new Date('2026-03-05T07:08:09Z'));

    expect(info.pkg).toEqual({
      dependencies: { vue: '^3.5.0' },
      devDependencies: { vite: '^8.0.0' },
      name: 'demo',
      version: '1.2.3',
    });
    // 只断言到分钟：时区随机器变化，秒级断言会在 CI 上闪断
    expect(info.lastBuildTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('resolveLibExternals', () => {
  it('dependencies 与 peerDependencies 都要排除，且去重排序', () => {
    const external = resolveLibExternals({
      dependencies: { 'es-toolkit': '^1.0.0', vue: '^3.5.0' },
      name: '@antdv/ui',
      peerDependencies: { vue: '^3.5.0' },
    });
    expect(external).toEqual(['es-toolkit', 'vue']);
  });

  it('extra 追加在集合里，不会漏掉手写的外部依赖', () => {
    const external = resolveLibExternals(
      { dependencies: { vue: '^3.5.0' } },
      ['dayjs'],
    );
    expect(external).toEqual(['dayjs', 'vue']);
  });

  it('空 package.json 只返回 extra', () => {
    expect(resolveLibExternals({}, ['x'])).toEqual(['x']);
    expect(resolveLibExternals({})).toEqual([]);
  });
});
