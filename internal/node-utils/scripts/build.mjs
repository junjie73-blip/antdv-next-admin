#!/usr/bin/env node
 
/**
 * stub 构建：只出 JS、跳过 d.ts 生成，用于本地联调。
 *
 * 下游（apps/web 的 vite.config、apps/backend-mock 的 nitro 配置）都是 Node 进程，
 * 改一次 node-utils 源码不必等真正的 d.ts 生成，`pnpm --filter @antdv/node-utils stub`
 * 就能立刻拿到新的 dist/index.mjs；正式打包仍走 `build`（tsdown，含 d.ts）。
 *
 * 但 package.json 的 `exports.types` 指向 dist/index.d.mts，而 tsdown 会先清空 dist，
 * 于是 stub 之后类型入口就不存在了，下游 `tsc --noEmit` 全部报 TS7016。
 * 所以这里补一个"类型桩"：直接 re-export 源码，让 TS 顺着 src 去解析，
 * 顺带保证 stub 与源码永远一致（不必重新生成声明）。
 * 本包 private 且不会发布，dist 外仍带 src，指向源码是安全的。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));

async function runWithTsdown() {
  const { build } = await import('tsdown');
  await build({ dts: false });
}

function runWithCli() {
  const result = spawnSync('tsdown', [], {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `tsdown CLI failed with exit code ${String(result.status)}`,
    );
  }
}

try {
  await runWithTsdown();
} catch (error) {
  console.warn(
    `[node-utils] tsdown API unavailable, falling back to CLI: ${error instanceof Error ? error.message : String(error)}`,
  );
  await runWithCli();
}

const hasSource = existsSync(`${cwd}src/index.ts`);

if (hasSource) {
  await mkdir(`${cwd}dist`, { recursive: true });
  await writeFile(
    `${cwd}dist/index.d.mts`,
    'export * from "../src/index";\n',
    'utf8',
  );
}
