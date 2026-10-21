#!/usr/bin/env node

/**
 * 统一构建标准守卫。
 *
 * 规则写在 `docs/guide/essentials/development.md` 的「子包统一构建标准」一节，
 * 这里只负责把它变成可执行的检查：
 *
 * 1. 每个 workspace 包都要有 `build`（完整编译打包）；只有原文件、没有可编译源的
 *    包必须登记在 `NO_BUILD_PACKAGES` 里并写清理由。
 * 2. `stub` 这类"快构建"只能与 `build` 并存，不能成为唯一构建入口。
 * 3. 入口指向 `dist/` 的包必须把 `dist` 写进 `files`（否则 `pnpm pack` 出来的包是空的）。
 * 4. 按源码发布的包（入口指向 `src/`）不得自带 `dev` / watch —— 它的热更新由宿主应用
 *    的 dev server 提供；自己再挂一个 watcher 就是"一半构建、一半热更新"的混合配置。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import process from 'node:process';

/** 只出 JSON / ESM 原文件，没有需要编译的源 */
const NO_BUILD_PACKAGES = new Map([
  ['@antdv/commitlint-config', '入口就是 index.mjs 本身'],
  ['@antdv/stylelint-config', '入口就是 index.mjs 本身'],
  ['@antdv/tsconfig', '只有 base.json / node.json / web.json 三份 tsconfig'],
]);

const SCOPES = ['packages', 'internal', 'scripts', 'apps', 'docs'];
/** 生成物与缓存目录里的 package.json 不是 workspace 成员 */
const SKIPPED = new Set([
  '.nitro',
  '.output',
  '.vitepress',
  'dist',
  'node_modules',
]);

/** 手写遍历：这是仓库级脚本，不该为了找文件再拖一个 glob 依赖进来 */
function findManifests(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'package.json'))
    out.push(join(dir, 'package.json'));
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIPPED.has(entry.name)) continue;
    findManifests(join(dir, entry.name), out);
  }
  return out;
}

const root = process.cwd();
const manifests = SCOPES.flatMap((scope) =>
  findManifests(join(root, scope), []),
)
  .map((path) => normalize(path).slice(root.length + 1))
  .toSorted();

/** 收集所有可能指向产物的入口字段 */
function entryTargets(pkg) {
  const plain = [pkg.main, pkg.module, pkg.types].filter(
    (value) => typeof value === 'string',
  );
  const fromExports = [];
  const visit = (value) => {
    if (typeof value === 'string') fromExports.push(value);
    else if (value && typeof value === 'object')
      Object.values(value).forEach((item) => visit(item));
  };
  visit(pkg.exports);
  return [...plain, ...fromExports];
}

const failures = [];

for (const relative of manifests) {
  const path = join(root, relative);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const label = `${pkg.name ?? relative} (${normalize(relative)})`;
  const scripts = pkg.scripts ?? {};
  const targets = entryTargets(pkg);
  const publishesDist = targets.some((target) => target.includes('/dist/'));
  const publishesSource = targets.some((target) => target.includes('/src/'));

  if (!scripts.build) {
    const reason = NO_BUILD_PACKAGES.get(pkg.name);
    if (!reason) {
      failures.push(
        `${label} 缺少 \`build\` 脚本。子包必须能完整编译打包并产出 dist；` +
          `若确实没有可编译的源，请把包名与理由加进 scripts/check-uniform-build.mjs 的 NO_BUILD_PACKAGES。`,
      );
    }
  }

  if (scripts.stub && !scripts.build) {
    failures.push(
      `${label} 只有 \`stub\`：stub 可以是 build 的加速替身，不能是唯一的构建入口。`,
    );
  }

  if (
    publishesDist &&
    Array.isArray(pkg.files) &&
    !pkg.files.includes('dist')
  ) {
    failures.push(
      `${label} 的入口指向 dist，但 \`files\` 里没有 "dist" —— 打包出来的会是空包。`,
    );
  }

  if (publishesSource && !publishesDist && (scripts.dev ?? scripts.watch)) {
    failures.push(
      `${label} 按源码发布（入口在 src），却自带 \`dev\`/\`watch\`：热更新由宿主应用的 dev server 提供，` +
        `包内再挂 watcher 就是混合构建配置。`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `子包统一构建标准检查未通过（${String(failures.length)} 项）：`,
  );
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `子包统一构建标准检查通过：${String(manifests.length)} 个包都有 build / 无 stub-only / 源码发布包不挂 watch。`,
);
