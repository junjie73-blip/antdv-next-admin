import type { WorkspacePackage } from '../src/monorepo';

import { describe, expect, it } from 'vitest';

import {
  listWorkspacePackages,
  packageOfPath,
  packagesDependingOn,
  parseCatalog,
  parseWorkspaceGlobs,
  readWorkspaceConfig,
} from '../src/monorepo';
import { findRepoRoot } from '../src/path';

const FIXTURE = `packages:
  - 'apps/*'
  - 'internal/*'
  - 'packages/*'

catalog:
  "dayjs": "^1.11.23"
  vue: ^3.5.0
  # 注释行不算依赖
  "vitest": "^4.1.11"  # 行尾注释

overrides:
  "foo": "1.0.0"
`;

describe('parseCatalog', () => {
  it('读取 catalog 段并在下一个顶层键处停止', () => {
    const catalog = parseCatalog(FIXTURE);
    expect(catalog).toEqual({
      dayjs: '^1.11.23',
      vitest: '^4.1.11',
      vue: '^3.5.0',
    });
    expect(catalog.foo).toBeUndefined();
  });

  it('空输入返回空对象', () => {
    expect(parseCatalog('')).toEqual({});
  });
});

describe('parseWorkspaceGlobs', () => {
  it('解析 packages 列表', () => {
    expect(parseWorkspaceGlobs(FIXTURE)).toEqual([
      'apps/*',
      'internal/*',
      'packages/*',
    ]);
  });
});

function pkg(name: string, dir: string, deps: string[] = []): WorkspacePackage {
  return {
    dependencies: Object.fromEntries(deps.map((dep) => [dep, 'workspace:*'])),
    devDependencies: {},
    dir,
    name,
    private: true,
    version: '0.0.0',
  };
}

describe('packageOfPath', () => {
  const packages = [
    pkg('@antdv/web', '/repo/apps/web'),
    pkg('@antdv/utils', '/repo/apps/web/utils'),
  ];

  it('命中最深的包，而不是外层目录', () => {
    expect(
      packageOfPath(packages, '/repo', 'apps/web/utils/src/index.ts')?.name,
    ).toBe('@antdv/utils');
  });

  it('未归属任何包时返回 undefined', () => {
    expect(packageOfPath(packages, '/repo', 'docs/README.md')).toBeUndefined();
  });
});

describe('packagesDependingOn', () => {
  const packages = [
    pkg('@antdv/types', '/repo/packages/types'),
    pkg('@antdv/web', '/repo/apps/web', ['@antdv/types']),
    pkg('@antdv/other', '/repo/packages/other'),
  ];

  it('正向依赖 + 排除自身', () => {
    expect(
      packagesDependingOn(packages, '@antdv/types').map((item) => item.name),
    ).toEqual(['@antdv/web']);
  });
});

describe('真实仓库', () => {
  it('能从子包目录向上定位到仓库根', async () => {
    const root = await findRepoRoot();
    expect(root).toBeTruthy();
  });

  it('列出 monorepo 的全部子包，且都带名字与绝对路径', async () => {
    const root = (await findRepoRoot()) as string;
    const packages = await listWorkspacePackages(root);
    const names = packages.map((item) => item.name);

    expect(names).toContain('@antdv/web');
    expect(names).toContain('@antdv/node-utils');
    expect(names).toContain('@antdv/types');
    expect(
      packages.every((item) => item.dir.startsWith(root.replaceAll('\\', '/'))),
    ).toBe(true);
  });

  it('apps/web 依赖 @antdv/types（catalog + workspace 协议生效）', async () => {
    const root = (await findRepoRoot()) as string;
    const packages = await listWorkspacePackages(root);
    expect(
      packagesDependingOn(packages, '@antdv/types').some(
        (item) => item.name === '@antdv/web',
      ),
    ).toBe(true);
  });

  it('根 pnpm-workspace.yaml 的 catalog 可被读取', async () => {
    const root = (await findRepoRoot()) as string;
    const { catalog, globs } = await readWorkspaceConfig(root);
    expect(globs).toContain('internal/*');
    expect(catalog.tsdown).toBeTruthy();
    expect(catalog.turbo).toBeTruthy();
  });
});
