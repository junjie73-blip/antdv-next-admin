#!/usr/bin/env node
 
/**
 * stub 构建：只出 JS、跳过 d.ts，用于本地联调。
 *
 * 下游（apps/web 的 vite.config、apps/backend-mock 的 nitro 配置）都是 Node 进程，
 * 改一次 node-utils 源码不必等 d.ts 生成，`pnpm --filter @antdv/node-utils stub`
 * 就能立刻拿到新的 dist/index.mjs；正式打包仍走 `build`（tsdown，含 d.ts）。
 */
import { spawnSync } from 'node:child_process';
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
