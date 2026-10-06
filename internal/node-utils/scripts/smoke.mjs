// 产物级冒烟：直接用 Node 跑 dist，验证「包能被 Node 进程消费」这件事。
// vitest 走 Vite 解析，会容忍无扩展名的子路径导入（例如 dayjs/plugin/relativeTime），
// 而 Node ESM 要求写全扩展名；只有这里才能暴露这类问题。
import * as m from '../dist/index.mjs';

console.log('formatDate:', m.formatDate('2026-10-06T08:30:00Z'));
console.log('fromNow:', m.fromNow(Date.now()));
console.log('formatBytes:', m.formatBytes(2048));

const pkgs = await m.listWorkspacePackages();
console.log('workspace packages:', pkgs.length);
console.log('repoRelative:', m.repoRelative());
console.log('confirmInTerminal(non-tty):', m.confirmInTerminal('q?', true));
console.log('SMOKE OK');
