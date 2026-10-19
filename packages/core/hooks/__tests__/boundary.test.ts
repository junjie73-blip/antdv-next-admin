import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  peerDependencies?: Record<string, string>;
};

/** 导入说明符：静态、动态、re-export、副作用导入都算 */
const IMPORT_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/gu;

/** CSS 里带路径的指令：@source 是 Tailwind 的内容登记，其余是样式引用 */
const CSS_SPECIFIER =
  /@(?:import|plugin|reference|source)\s+['"]([^'"]+)['"]/gu;

/** 盘符、根路径、UNC、file: —— 换一台机器就失效，一律禁止（单反斜杠开头是测试里的正则字面量，不是路径） */
const ABSOLUTE_SPECIFIER = /^(?:[a-z]:[\\/]|\/|\\\\|file:)/iu;

/** 全仓唯一被允许用相对路径伸到别的包里的地方，理由写在那个文件的头注释里 */
const DESIGN_ENTRY_CSS = 'packages/core/base/design/src/index.css';

const manifestCache = new Map<string, Manifest | undefined>();

function stripComments(source: string): string {
  return source
    .replaceAll(/<!--[\S\s]*?-->/gu, '')
    .replaceAll(/\/\*[\S\s]*?\*\//gu, '')
    .replaceAll(/^\s*\/\/.*$/gmu, '')
    .replaceAll(/^\s*\*.*$/gmu, '');
}

function readManifestAt(file: string): Manifest | undefined {
  if (!manifestCache.has(file))
    manifestCache.set(file, JSON.parse(readFileSync(file, 'utf8')) as Manifest);
  return manifestCache.get(file);
}

/** 从任意文件或目录往上找最近的 package.json 所在目录；仓库外或 packages 顶层之上返回 undefined */
function findPackageRoot(from: string): string | undefined {
  let dir = from;
  while (dir !== PACKAGES_DIR && dir.startsWith(`${PACKAGES_DIR}${path.sep}`)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

function manifestOf(from: string): Manifest | undefined {
  const root = findPackageRoot(from);
  return root === undefined
    ? undefined
    : readManifestAt(path.join(root, 'package.json'));
}

/** `@antdv/shared/utils/cn` -> `@antdv/shared`；未加作用域的裸包名返回 undefined（本仓不关心） */
function scopedName(specifier: string): string | undefined {
  if (!specifier.startsWith('@')) return undefined;
  const [scope, name] = specifier.slice(1).split('/');
  return scope && name ? `@${scope}/${name}` : undefined;
}

function specifiersOf(file: string, pattern: RegExp): string[] {
  const text = stripComments(readFileSync(file, 'utf8'));
  return [...text.matchAll(pattern)]
    .map((match) => match[1])
    .filter((specifier): specifier is string => specifier !== undefined);
}

const ALL_FILES = walk(PACKAGES_DIR);
const SOURCE_FILES = ALL_FILES.filter((file) => !file.endsWith('package.json'));

/** 仓库里的子包：包名 -> 包根目录，用来判断一个说明符是不是本仓的包 */
const WORKSPACE_PACKAGES = new Map(
  ALL_FILES.filter((file) => file.endsWith('package.json')).map((file) => [
    readManifestAt(file)?.name ?? '',
    path.dirname(file),
  ]),
);

function manifestOffenders(file: string): string[] {
  const pkg = readManifestAt(file);
  return [
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.peerDependencies ?? {}),
  ].filter((name) => name === 'antdv-next' || name.startsWith('@antdv-next/'));
}

describe('子包不依赖 antdv-next', () => {
  it('源码里没有组件库的 import', () => {
    const offenders = SOURCE_FILES.filter((file) =>
      COMPONENT_LIB_IMPORT.test(readFileSync(file, 'utf8')),
    )
      .map((file) => relative(file))
      .toSorted();

    expect(offenders).toStrictEqual([]);
  });

  it('清单的 dependencies / peerDependencies 里没有组件库', () => {
    const offenders = ALL_FILES.filter((file) => file.endsWith('package.json'))
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

/**
 * 上一节守「不许认识组件库」，这一节守「包与包之间只通过清单和 exports 相见」。
 * 相对路径伸进别人的 src 会让边界消失（谁都能改你内部文件）；未声明的 `@antdv/*`
 * 只是靠 node_modules 里的软链侥幸能跑，`pnpm prune` 一清就崩，exports 里改名也没人接得住。
 *
 * 例外只有 `@antdv/design` 的 `@source`：Tailwind v4 的内容登记只认文件系统路径，而构建根在
 * `apps/web`，`packages/` 全在自动检测之外。所以这里用「白名单 + 存在性 + 完整性」代替禁令，
 * 漏登记的失败形态从「组件渲染出来了但没样式」变成一条测试。
 */
describe('跨包只走包名导入', () => {
  const scriptFiles = SOURCE_FILES.filter((file) => !file.endsWith('.css'));

  function escapesPackage(file: string, specifier: string): boolean {
    const root = findPackageRoot(file);
    if (!root) return true;
    return !path
      .resolve(path.dirname(file), specifier)
      .startsWith(`${root}${path.sep}`);
  }

  function isPackageSource(file: string): boolean {
    const root = findPackageRoot(file);
    return (
      root !== undefined && file.startsWith(`${root}${path.sep}src${path.sep}`)
    );
  }

  it('没有伸到别的包里的相对路径，也没有绝对路径', () => {
    const offenders: string[] = [];
    for (const file of scriptFiles) {
      for (const specifier of specifiersOf(file, IMPORT_SPECIFIER)) {
        if (
          ABSOLUTE_SPECIFIER.test(specifier) ||
          (specifier.startsWith('.') && escapesPackage(file, specifier))
        )
          offenders.push(`${relative(file)} -> ${specifier}`);
      }
    }

    expect(offenders.toSorted()).toStrictEqual([]);
  });

  it('跨包的 workspace 依赖都写在 dependencies / peerDependencies 里', () => {
    const offenders: string[] = [];
    for (const file of scriptFiles) {
      const pkg = manifestOf(file);
      const declared = new Set([
        ...Object.keys(pkg?.dependencies ?? {}),
        ...Object.keys(pkg?.peerDependencies ?? {}),
      ]);
      for (const specifier of specifiersOf(file, IMPORT_SPECIFIER)) {
        const name = scopedName(specifier);
        if (!name || name === pkg?.name || !WORKSPACE_PACKAGES.has(name))
          continue;
        if (!declared.has(name)) offenders.push(`${relative(file)} -> ${name}`);
      }
    }

    expect(offenders.toSorted()).toStrictEqual([]);
  });

  it('包内 src 不通过自己的包名绕 barrel', () => {
    // 组件 -> src/index.ts -> 组件 是环；bundle 阶段能跑，按源码消费的兄弟包会拿到 undefined。
    const offenders: string[] = [];
    for (const file of scriptFiles.filter((f) => isPackageSource(f))) {
      const name = manifestOf(file)?.name;
      if (!name) continue;
      for (const specifier of specifiersOf(file, IMPORT_SPECIFIER)) {
        if (scopedName(specifier) === name)
          offenders.push(`${relative(file)} -> ${specifier}`);
      }
    }

    expect(offenders.toSorted()).toStrictEqual([]);
  });

  it('@source 名单只属于 design，且覆盖所有带 .vue 的包', () => {
    const designEntry = path.join(REPO_ROOT, DESIGN_ENTRY_CSS);

    const elsewhere = SOURCE_FILES.filter(
      (file) => file.endsWith('.css') && file !== designEntry,
    ).flatMap((file) =>
      specifiersOf(file, CSS_SPECIFIER)
        .filter(
          (specifier) =>
            specifier.startsWith('.') && escapesPackage(file, specifier),
        )
        .map((specifier) => `${relative(file)} -> ${specifier}`),
    );
    expect(elsewhere.toSorted()).toStrictEqual([]);

    // 指到别的包的那些 @source 才是要登记的；./css、./token 是本包自己的分部
    const targets = specifiersOf(designEntry, CSS_SPECIFIER)
      .filter(
        (specifier) =>
          specifier.startsWith('.') && escapesPackage(designEntry, specifier),
      )
      .map((specifier) => path.resolve(path.dirname(designEntry), specifier))
      .toSorted();
    for (const target of targets)
      expect(existsSync(target), `${relative(target)} 不存在`).toBe(true);

    const registered = targets
      .map((target) => manifestOf(target)?.name)
      .filter((name): name is string => name !== undefined);

    const withVue = new Set(
      SOURCE_FILES.filter(
        (file) => file.endsWith('.vue') && isPackageSource(file),
      )
        .map((file) => manifestOf(file)?.name)
        .filter((name): name is string => name !== undefined),
    );

    expect(registered.toSorted()).toStrictEqual([...withVue].toSorted());
  });
});
