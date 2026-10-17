import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 子包不得依赖 antdv-next —— 这条不变量属于 `packages/` 全体，所以放在这里一次守住。
 *
 * 为什么值得写成测试：引一个 UI 库只要一行，代价是所有子包的产物都多背一份组件库，
 * 而且包一旦认识 antd 就再也无法脱离它复用。历史上 `shared`、`preferences`、
 * `utils`、`types`、`hooks` 都因此被逐一拆过。
 *
 * 口径：
 * - 源码只拦「导入形态」（`from 'antdv-next'` / `import('antdv-next')` / `@antdv-next/*`），
 *   注释与测试里的 URL、`tokenCrypto.ts` 里的 `'antdv-next-token-*'` 字面量不算违规；
 * - 清单只查 `dependencies` / `peerDependencies`，devDependencies 里为对照实验装的允许存在。
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

const SOURCE_EXTENSIONS = ['.css', '.ts', '.tsx', '.vue'];
const SKIPPED_DIRS = new Set(['.turbo', 'dist', 'node_modules']);
/** 本文件自己写着那条正则，扫它会自我命中 */
const SELF = 'boundary.test.ts';

/** 组件库导入形态：具名/默认/命名空间、静态与动态、子路径都算 */
const COMPONENT_LIB_IMPORT =
  /(?:from|import)\s*\(?\s*['"](?:antdv-next|@antdv-next\/)/u;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name) || entry.name === SELF) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
      out.push(full);
    else if (entry.name === 'package.json') out.push(full);
  }
  return out;
}

function relative(file: string): string {
  return path.relative(REPO_ROOT, file).replaceAll('\\', '/');
}

function manifestOffenders(file: string): string[] {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? []),
  ].filter((name) => name === 'antdv-next' || name.startsWith('@antdv-next/'));
}

describe('子包不依赖 antdv-next', () => {
  const files = walk(PACKAGES_DIR);

  it('源码里没有组件库的 import', () => {
    const offenders = files
      .filter((file) => !file.endsWith('package.json'))
      .filter((file) => COMPONENT_LIB_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(file))
      .toSorted();

    expect(offenders).toStrictEqual([]);
  });

  it('清单的 dependencies / peerDependencies 里没有组件库', () => {
    const offenders = files
      .filter((file) => file.endsWith('package.json'))
      .flatMap((file) =>
        manifestOffenders(file).map((name) => `${relative(file)} -> ${name}`),
      )
      .toSorted();

    expect(offenders).toStrictEqual([]);
  });

  it('轻提示走 @antdv/popup-ui（shadcn 栈里 vue-sonner 的封装）', () => {
    const usePrint = readFileSync(
      path.join(PACKAGES_DIR, 'core/hooks/src/use-print.ts'),
      'utf8',
    );

    expect(usePrint).toMatch(/import \{ message \} from '@antdv\/popup-ui'/u);
  });

  it('实时通信只在 @antdv/request 里', () => {
    const requestSrc = path.join(PACKAGES_DIR, 'request/src');
    for (const dir of ['sse', 'websocket']) {
      expect(
        readdirSync(requestSrc, { withFileTypes: true }).some(
          (entry) => entry.name === dir && entry.isDirectory(),
        ),
        `${dir} 应该在 request/src 下`,
      ).toBe(true);
    }
  });
});
