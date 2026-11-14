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
  exports?: Record<string, string>;
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

/**
 * 应用侧的样式装配入口：唯一的 Tailwind root，逐条 `@import` 各包的 `style.css`。
 * 内容登记不再集中在 `@antdv/design`，所以守门要一路查到"应用真的引了"为止。
 */
const APP_STYLE_ENTRY = 'apps/web/src/styles/index.css';

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
 * Tailwind v4 的内容登记只认文件系统路径，而构建根在 `apps/web`，`packages/` 全在自动检测之外，
 * 所以每个带模板的包都要显式 `@source`。登记跟着包走：包自己的 `src/index.css` 只写 `@source './';`，
 * 经 exports 的 `./style.css` 暴露，由应用侧的样式装配入口逐条 `@import` 收进同一个 root。
 * 这里守三件事：CSS 里的相对路径不伸进别包、每个带 .vue 的包都登记并暴露了自己、应用真的引到了每一个。
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

  it('cSS 里的相对路径不伸进别的包：@source 只登记自己', () => {
    /**
     * 旧口径是「@source 名单只属于 design」—— 那时 design 用相对路径伸进 15 个包，
     * 是全仓唯一的例外。现在登记跟着包走（每个包 `src/index.css` 里一句 `@source './';`），
     * 例外取消：**任何**包的 CSS 都只许指自己目录里的东西，跨包一律走包名
     * （应用侧 `@import '@antdv/x/style.css'`）。design 自己现在一条 @source 都没有。
     */
    const offenders = SOURCE_FILES.filter((file) =>
      file.endsWith('.css'),
    ).flatMap((file) =>
      specifiersOf(file, CSS_SPECIFIER)
        .filter(
          (specifier) =>
            specifier.startsWith('.') && escapesPackage(file, specifier),
        )
        .map((specifier) => `${relative(file)} -> ${specifier}`),
    );
    expect(offenders.toSorted()).toStrictEqual([]);
  });

  it('每个带 .vue 的包都自己登记 @source、暴露 ./style.css，并被应用入口引到', () => {
    const withVue = new Set(
      SOURCE_FILES.filter(
        (file) => file.endsWith('.vue') && isPackageSource(file),
      )
        .map((file) => manifestOf(file)?.name)
        .filter((name): name is string => name !== undefined),
    );
    expect(withVue.size).toBeGreaterThan(0);

    for (const name of withVue) {
      const root = WORKSPACE_PACKAGES.get(name);
      expect(root, `${name} 应该有包根目录`).toBeDefined();
      if (root === undefined) continue;

      // 1. 包自己的样式入口存在，且登记的就是自己的 src（不是别的目录、也不是空文件）
      const entry = path.join(root, 'src/index.css');
      expect(existsSync(entry), `${name} 缺 src/index.css`).toBe(true);
      const registered = specifiersOf(
        entry,
        /@source\s+['"]([^'"]+)['"]/gu,
      ).map((specifier) => path.resolve(path.dirname(entry), specifier));
      expect(registered, `${name} 的 @source 应该只登记 ./`).toStrictEqual([
        path.join(root, 'src'),
      ]);

      // 2. exports 里真的有 ./style.css，且指回这个文件（漏写 = 应用侧 resolve 失败）
      const manifest = readManifestAt(path.join(root, 'package.json'));
      expect(
        manifest?.exports?.['./style.css'],
        `${name} 缺 ./style.css 出口`,
      ).toBe('./src/index.css');
    }

    // 3. 应用侧的装配入口把每一个都引到了：漏一条就是那个包的工具类静默不生成
    const appEntry = path.join(REPO_ROOT, APP_STYLE_ENTRY);
    expect(existsSync(appEntry), `应用样式入口 ${APP_STYLE_ENTRY} 不存在`).toBe(
      true,
    );
    const imported = specifiersOf(appEntry, CSS_SPECIFIER);
    for (const name of withVue) {
      expect(imported, `${name}/style.css 没被应用入口引到`).toContain(
        `${name}/style.css`,
      );
    }

    // 4. 入口必须真的挂在应用入口 TS 上，否则名单再全也只是一个没人读的死文件
    const main = readFileSync(
      path.join(REPO_ROOT, 'apps/web/src/main.ts'),
      'utf8',
    );
    expect(main).toContain("import './styles/index.css';");
  });

  /**
   * 默认 ui 子包（`@antdv/shadcn-ui`）额外获准在 barrel 里自引自己的 CSS。
   * 口子只开给它一个：自引对 `@source` 是惰性的（只有 @source 的文件不构成 Tailwind root），
   * 每个包都跟着自引只会往页面里塞一堆空样式，登记还是得靠应用侧装配。
   * 所以这里守两件事：谁可以自引、引的是不是自己的样式入口。
   */
  it('只有默认 ui 子包可以在 barrel 里自引 CSS，且引的必须是自己的样式入口', () => {
    const DEFAULT_UI_PACKAGE = '@antdv/shadcn-ui';
    const offenders: string[] = [];

    for (const [name, root] of WORKSPACE_PACKAGES) {
      const barrel = path.join(root, 'src/index.ts');
      if (!existsSync(barrel)) continue;
      const selfCss = specifiersOf(barrel, IMPORT_SPECIFIER).filter(
        (specifier) => specifier.startsWith('.') && specifier.endsWith('.css'),
      );
      if (selfCss.length === 0) continue;
      if (name !== DEFAULT_UI_PACKAGE) {
        offenders.push(`${name} 的 barrel 自引了 CSS -> ${selfCss.join(', ')}`);
        continue;
      }
      for (const specifier of selfCss) {
        if (specifier !== './index.css')
          offenders.push(`${name} 自引的不是自己的样式入口 -> ${specifier}`);
      }
    }

    expect(offenders.toSorted()).toStrictEqual([]);

    // 自引不替代装配：默认包的 style.css 仍然必须被应用入口引到
    const appEntry = path.join(REPO_ROOT, APP_STYLE_ENTRY);
    expect(specifiersOf(appEntry, CSS_SPECIFIER)).toContain(
      `${DEFAULT_UI_PACKAGE}/style.css`,
    );
  });
});
