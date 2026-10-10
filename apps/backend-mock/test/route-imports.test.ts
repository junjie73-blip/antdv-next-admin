import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 回归防护：Nitro 的 `server/api/**` 按目录层级手写相对路径引 `server/utils`，
 * 多一层 `../` 就指到 `apps/backend-mock/utils`，Rollup 报
 * "Could not resolve"——而这类错误只在服务真正启动时才暴露，接口会静默 404/500。
 * 这里做纯静态解析，把整棵 handler 树的相对导入一次校验完。
 */

const SERVER_DIR = path.resolve(import.meta.dirname, '../server');
const EXTENSIONS = ['', '.ts', '.mjs', '.js', '/index.ts', '/index.mjs'];
const SKIP = new Set(['.nitro', '.output', '.turbo', 'dist', 'node_modules']);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, acc);
    else if (/\.(?:ts|mjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** 覆盖 `from '../x'`、`import '../x'` 与动态 `import('../x')` */
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.[^'"\n]+)['"]/g;

function unresolvedImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(RELATIVE_IMPORT)]
    .map((match) => match[1] as string)
    .filter(
      (specifier) =>
        !EXTENSIONS.some((suffix) =>
          fs.existsSync(path.resolve(path.dirname(file), specifier) + suffix),
        ),
    )
    .map((specifier) => `${path.relative(SERVER_DIR, file)} -> ${specifier}`);
}

describe('server 侧相对导入', () => {
  const files = collectSourceFiles(SERVER_DIR);

  it('确实扫到了整棵 handler 树', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('每个 `.` 开头的说明符都能落到真实文件', () => {
    expect(files.flatMap(unresolvedImports)).toEqual([]);
  });

  it('utils 里的相对导入同样可达（含 db 子目录）', () => {
    const utilsFiles = collectSourceFiles(path.join(SERVER_DIR, 'utils'));
    expect(utilsFiles.length).toBeGreaterThan(5);
    expect(utilsFiles.flatMap(unresolvedImports)).toEqual([]);
  });
});
