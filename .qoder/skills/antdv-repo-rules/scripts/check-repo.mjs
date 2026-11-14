#!/usr/bin/env node
/**
 * 仓库静态体检（只读，不改任何文件）。
 *
 * 在本仓库根执行（`<skill-dir>` 是本技能 SKILL.md 所在目录，项目级安装时为
 * `.qoder/skills/antdv-repo-rules`；用户级或其它平台安装时换成实际路径即可）：
 *
 *   node <skill-dir>/scripts/check-repo.mjs
 *   node <skill-dir>/scripts/check-repo.mjs --only tokens,@source
 *   node <skill-dir>/scripts/check-repo.mjs --json
 *
 * 只做"机器能判、且判错代价低"的事：依赖边界、跨包路径、@source 覆盖与失效、
 * token 命名空间、写死版本号的依赖、交付卫生。
 * 它不替代单测 / 类型检查 / 三引擎 e2e。
 */
/* oxlint-disable no-console unicorn/no-process-exit -- CLI 脚本：stdout 是产物，退出码是结论（仓库对 scripts/** 也是这个口径） */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 仓库根靠工作区标记认，不靠"技能装在第几层"：项目级、用户级与其它 Agent 平台的安装深度不同。 */
const isWorkspaceRoot = (dir) =>
  existsSync(join(dir, 'pnpm-workspace.yaml')) &&
  existsSync(join(dir, 'turbo.json'));
function findRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (isWorkspaceRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
const ROOT = findRoot(HERE) ?? findRoot(process.cwd());
if (ROOT === undefined) {
  console.error(
    '未找到仓库根：请在含 pnpm-workspace.yaml 与 turbo.json 的仓库内运行本脚本。',
  );
  process.exit(1);
}

/** 环境退化提示：不算违反，但要让读结果的人知道某一步没跑（避免"静默变绿"） */
const notes = [];

const SKIP_DIRS = new Set([
  '.git',
  '.nitro',
  '.output',
  '.turbo',
  '.vitepress',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

const SOURCE_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx', '.vue']);

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
/** 统一成正斜杠再比较：Windows 上 join/resolve 产出反斜杠，混着比会永远不相等 */
const fwd = (p) => p.replaceAll('\\', '/');
const under = (file, dir) => file === dir || file.startsWith(`${dir}/`);
const isTestFile = (p) =>
  p.includes('__tests__') || /\.(spec|test)\.[cm]?[tsx]$/u.test(p);
const hasSourceExt = (f) => SOURCE_EXT.has(f.slice(f.lastIndexOf('.')));
const sourceFiles = () =>
  walk(join(ROOT, 'packages')).filter((f) => hasSourceExt(f) && !isTestFile(f));
const appFiles = () =>
  walk(join(ROOT, 'apps/web/src')).filter((f) => hasSourceExt(f));

/** 每个 @antdv/* 包：{ name, dir } */
function workspacePackages() {
  const files = walk(ROOT).filter(
    (f) => f.endsWith('package.json') && !f.includes(`${'node_modules'}`),
  );
  const pkgs = [];
  for (const f of files) {
    let json;
    try {
      json = JSON.parse(readFileSync(f, 'utf8'));
    } catch {
      continue;
    }
    if (typeof json.name === 'string' && json.name.startsWith('@antdv/')) {
      pkgs.push({ name: json.name, dir: dirname(f), json });
    }
  }
  return pkgs;
}

const CHECKS = {
  /** packages/** 不许出现组件库导入 */
  imports(files) {
    const hits = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/from\s+['"](?:antdv-next|@antdv-next\/)/u.test(line)) {
          hits.push(`${rel(f)}:${i + 1} ${line.trim()}`);
        }
      });
    }
    return hits;
  },

  /**
   * 轻提示与实时通信的归属。
   *
   * `vue-sonner` 只许出现在封装层这三处（再往外引就绕过了主题外壳与"轻提示 / 通知"分流）；
   * 业务侧一律走 `@antdv/popup-ui`。`new WebSocket(` 只许在 `@antdv/request`。
   */
  owners(files, _pkgs, extraFiles) {
    const TOAST_OWNERS = [
      'packages/core/ui-kit/common-ui/src/components/toast/',
      'packages/core/ui-kit/popup-ui/',
      'packages/core/ui-kit/shadcn-ui/src/components/sonner/',
    ];
    const hits = [];
    for (const f of [...files, ...(extraFiles ?? [])]) {
      const r = rel(f);
      const text = readFileSync(f, 'utf8');
      if (
        /from\s+['"]vue-sonner['"]|import\s+['"]vue-sonner/u.test(text) &&
        !TOAST_OWNERS.some((owner) => r.startsWith(owner))
      ) {
        hits.push(`${r} 直接引了 vue-sonner（应走 @antdv/popup-ui）`);
      }
      if (/new WebSocket\(/u.test(text) && !r.startsWith('packages/request/')) {
        hits.push(`${r} 自己 new WebSocket（应走 @antdv/request）`);
      }
    }
    return hits;
  },

  /** 跨包只走包名：不许相对越界，也不许盘符/绝对路径 */
  paths(files, pkgs) {
    const hits = [];
    const dirs = pkgs
      .map((p) => fwd(p.dir))
      .toSorted((a, b) => b.length - a.length);
    const pkgOf = (f) => {
      const file = fwd(f);
      return dirs.find((dir) => under(file, dir));
    };
    for (const f of files) {
      const dir = pkgOf(f);
      if (!dir) continue;
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const m = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/u.exec(line);
        if (!m) return;
        const spec = m[1];
        if (/^[a-zA-Z]:[\\/]/u.test(spec) || spec.startsWith('file:/')) {
          hits.push(`${rel(f)}:${i + 1} 绝对/盘符路径 ${spec}`);
          return;
        }
        if (spec.startsWith('.')) {
          const target = fwd(resolve(dirname(f), spec));
          if (!under(target, dir)) {
            hits.push(`${rel(f)}:${i + 1} 相对导入越出本包 → ${spec}`);
          }
        }
      });
    }
    return hits;
  },

  /**
   * 内容登记跟着包走，不再集中在 design。
   *
   * Tailwind v4 的自动检测从 Vite 根（`apps/web`）往上扫，`packages/**` 全在扫描范围外，
   * 所以每个带模板的包都要显式 `@source`。新口径三件事：
   *   1. 包自己的 `src/index.css` 只登记自己（`@source './';`），并经 exports 的 `./style.css` 暴露；
   *   2. 应用侧 `apps/web/src/styles/index.css` 逐条 `@import '<包名>/style.css'` 收进同一个 root，
   *      且这个装配入口真的挂在 `apps/web/src/main.ts` 上；
   *   3. design 一条 `@source` 都不留，任何包的 CSS 相对路径都不许伸进别包。
   * 漏一环的失败形态是"组件渲染出来了但少一层圆角"——不报错，所以这里逐环查。
   * 与 `packages/core/hooks/__tests__/boundary.test.ts` 同口径（那边是守门测试，这边是快速体检）。
   */
  '@source': function (_files, pkgs) {
    const hits = [];
    /** CSS 里带路径的指令：@source 是内容登记，其余是样式引用 */
    const CSS_SPECIFIER =
      /@(?:import|plugin|reference|source)\s+['"]([^'"]+)['"]/gu;
    const SOURCE_SPECIFIER = /@source\s+['"]([^'"]+)['"]/gu;
    // 注释里讲历史（提到 @source、提到别包路径）不算依赖
    const stripComments = (s) =>
      s.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/^\s*\*.*$/gmu, '');
    const specifiersOf = (file, re) =>
      [...stripComments(readFileSync(file, 'utf8')).matchAll(re)].map(
        (m) => m[1],
      );

    const packagesDir = fwd(join(ROOT, 'packages'));
    const dirs = pkgs
      .map((p) => fwd(p.dir))
      .toSorted((a, b) => b.length - a.length);
    const pkgOf = (f) => dirs.find((dir) => under(fwd(f), dir));

    // 1. 任何包内 CSS 的相对路径都只许指自己包里（跨包一律走包名）
    const packageCss = walk(join(ROOT, 'packages')).filter((f) =>
      f.endsWith('.css'),
    );
    for (const f of packageCss) {
      const root = pkgOf(f);
      if (!root) continue;
      for (const spec of specifiersOf(f, CSS_SPECIFIER)) {
        if (!spec.startsWith('.')) continue;
        if (!under(fwd(resolve(dirname(f), spec)), root)) {
          hits.push(`${rel(f)} 的相对路径伸进别包 → ${spec}`);
        }
      }
    }

    // 2. design 不代管任何子包的内容登记
    const designIndex = join(ROOT, 'packages/core/base/design/src/index.css');
    if (!existsSync(designIndex)) {
      hits.push('design/src/index.css 不见了');
    } else if (specifiersOf(designIndex, SOURCE_SPECIFIER).length > 0) {
      hits.push(
        `${rel(designIndex)} 里还有 @source（内容登记已随包走，设计规范不代管子包模板）`,
      );
    }

    // 3. 每个带 .vue 的包：入口存在 + 只登记自己 + exports 暴露 + 应用引到
    const withVue = pkgs.filter(
      (p) =>
        under(fwd(p.dir), packagesDir) &&
        walk(join(p.dir, 'src')).some((f) => f.endsWith('.vue')),
    );
    if (withVue.length === 0) {
      hits.push('packages/** 下没找到任何带 .vue 的包（枚举口径可能坏了）');
    }
    const appEntry = join(ROOT, 'apps/web/src/styles/index.css');
    const imported = existsSync(appEntry)
      ? specifiersOf(appEntry, CSS_SPECIFIER)
      : [];
    if (!existsSync(appEntry))
      hits.push(`应用样式装配入口不存在：${rel(appEntry)}`);

    const entryFiles = new Set();
    for (const p of withVue) {
      const entry = join(p.dir, 'src/index.css');
      entryFiles.add(fwd(entry));
      if (!existsSync(entry)) {
        hits.push(`${p.name} 缺 src/index.css（模板里的工具类会静默不生成）`);
        continue;
      }
      const registered = specifiersOf(entry, SOURCE_SPECIFIER).map((spec) =>
        fwd(resolve(dirname(entry), spec)),
      );
      if (
        registered.length !== 1 ||
        registered[0] !== fwd(join(p.dir, 'src'))
      ) {
        hits.push(
          `${rel(entry)} 的 @source 应该只有 ./（实际 ${registered.join(', ') || '空'}）`,
        );
      }
      const exported = p.json.exports?.['./style.css'];
      if (exported !== './src/index.css') {
        hits.push(
          `${p.name} 的 exports['./style.css'] 应为 ./src/index.css，实际 ${exported ?? '缺失'}`,
        );
      }
      const published = p.json.publishConfig?.exports?.['./style.css'];
      if (p.json.publishConfig?.exports && published !== './src/index.css') {
        hits.push(
          `${p.name} 的 publishConfig.exports['./style.css'] 与 exports 不一致（发版后会 resolve 失败）`,
        );
      }
      if (!imported.includes(`${p.name}/style.css`)) {
        hits.push(`${rel(appEntry)} 没 @import '${p.name}/style.css'`);
      }
    }

    // 4. 装配入口必须真的挂在应用入口上，否则名单再全也只是没人读的死文件
    const main = join(ROOT, 'apps/web/src/main.ts');
    if (
      existsSync(main) &&
      !readFileSync(main, 'utf8').includes("import './styles/index.css';")
    ) {
      hits.push(
        `${rel(main)} 没有 import './styles/index.css';（样式装配入口没被挂上）`,
      );
    }

    // 5. @source 只许出现在这些包自己的样式入口里
    for (const f of walk(ROOT).filter((x) => x.endsWith('.css'))) {
      if (entryFiles.has(fwd(f))) continue;
      if (/^\s*@source\s/mu.test(stripComments(readFileSync(f, 'utf8')))) {
        hits.push(
          `${rel(f)} 里出现 @source（内容登记只属于各包自己的 src/index.css）`,
        );
      }
    }
    return hits;
  },

  /** token 命名空间与取值格式 */
  tokens() {
    const hits = [];
    const dir = join(ROOT, 'packages/core/base/design/src');
    for (const f of walk(dir).filter((x) => x.endsWith('.css'))) {
      const raw = readFileSync(f, 'utf8');
      // 去掉注释再判，注释里讲历史是允许的
      const text = raw
        .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
        .replaceAll(/^\s*\/\/.*$/gmu, '');
      /**
       * 按「一条声明一条」扫，不按行 —— 一行里塞两条声明也要抓到
       * （压缩过的写法、以及把整个 `:root{…}` 写成一行的探针）。
       */
      const seen = new Set();
      for (const decl of text.split(/[;\n{]/u)) {
        const m = /^\s*(--[A-Za-z0-9-]*)\s*:\s*(.*)$/su.exec(decl);
        if (!m) continue;
        const key = `${m[1]}:${m[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const [, name, value] = m;
        if (
          name.startsWith('--app-') ||
          name.startsWith('--ant-') ||
          /-ant(-|$)/u.test(name)
        ) {
          hits.push(`${rel(f)} 声明了旧命名空间 ${name}`);
        }
        if (name.startsWith('--radius') && /\d+px/u.test(value)) {
          hits.push(
            `${rel(f)} 圆角用 px（基准必须是 rem）：${name}: ${value.trim()}`,
          );
        }
        if (
          /^--(primary|background|foreground|border|ring|popover|muted|accent|card)\b/u.test(
            name,
          ) &&
          (/#\s*[0-9a-f]{3,8}/iu.test(value) || /hsla?\(/iu.test(value))
        ) {
          hits.push(
            `${rel(f)} 规范名变量里存了完整颜色，应只存通道：${name}: ${value.trim()}`,
          );
        }
      }
    }
    return hits;
  },

  /** 外部依赖只能从 catalog 取 */
  catalog(_files, pkgs) {
    const hits = [];
    for (const p of pkgs) {
      for (const field of ['dependencies', 'peerDependencies']) {
        for (const [name, value] of Object.entries(p.json[field] ?? {})) {
          if (name.startsWith('@antdv/')) {
            if (!String(value).startsWith('workspace:')) {
              hits.push(
                `${rel(join(p.dir, 'package.json'))} ${name} 内部包应写 workspace:*，实际 ${value}`,
              );
            }
            continue;
          }
          if (!String(value).startsWith('catalog:')) {
            hits.push(
              `${rel(join(p.dir, 'package.json'))} ${name} 写死了 ${value}（应 catalog:）`,
            );
          }
        }
      }
    }
    return hits;
  },

  /** 交付卫生：临时探针、根目录垃圾、可疑已跟踪文件 */
  hygiene() {
    const hits = [];
    const e2e = join(ROOT, 'apps/web/e2e');
    if (existsSync(e2e)) {
      for (const n of readdirSync(e2e)) {
        if (/^tmp-.*\.spec\.ts$/u.test(n))
          hits.push(`临时探针未删除：apps/web/e2e/${n}`);
      }
    }
    for (const n of readdirSync(ROOT)) {
      if (/\.(log|zip|7z|rar)$/iu.test(n) || n === '.sync-state.json') {
        hits.push(`仓库根遗留产物：${n}（未入库也应清掉）`);
      }
    }
    let tracked = [];
    try {
      tracked = execFileSync('git', ['ls-files'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).split('\n');
    } catch {
      tracked = [];
      notes.push(
        'git 不可用：已跟踪文件名扫描未执行，这一项不构成"已跟踪文件也干净"的结论',
      );
    }
    for (const n of tracked) {
      if (/console\.log/iu.test(n)) {
        hits.push(`可疑的已跟踪文件名（只列名，不读内容）：${n}`);
      }
    }
    return hits;
  },
};

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const onlyInline = argv.find((a) => a.startsWith('--only='));
const onlyIdx = argv.indexOf('--only');
let only = '';
if (onlyInline) {
  only = onlyInline.slice('--only='.length);
} else if (onlyIdx !== -1) {
  only = argv[onlyIdx + 1] ?? '';
}
const requested = only
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((n) => n in CHECKS);
const names = requested.length > 0 ? requested : Object.keys(CHECKS);

const pkgs = workspacePackages();
const files = sourceFiles();
const appSource = appFiles();

const results = {};
let failed = 0;
for (const name of names) {
  const hits = CHECKS[name](files, pkgs, appSource);
  if (hits.length > 0) failed += 1;
  results[name] = hits;
}

if (json) {
  console.log(JSON.stringify({ root: ROOT, failed, results, notes }, null, 2));
} else {
  console.log(
    `antdv 仓库体检 · ${ROOT} · 包源码 ${files.length} 个文件 / ${pkgs.length} 个 @antdv/* 包 / 应用侧 ${appSource.length} 个文件`,
  );
  for (const name of names) {
    const hits = results[name];
    if (hits.length === 0) {
      console.log(`  PASS  ${name}`);
      continue;
    }
    console.log(`  FAIL  ${name}（${hits.length} 处）`);
    for (const h of hits.slice(0, 8)) console.log(`        - ${h}`);
    if (hits.length > 8) console.log(`        - …另有 ${hits.length - 8} 处`);
  }
  for (const note of notes) console.log(`  提示  ${note}`);
  console.log(
    failed === 0
      ? '结论：静态硬约束无违反项。'
      : `结论：${failed} 项检查有违反，先修再提交。`,
  );
}

process.exit(failed === 0 ? 0 : 1);
