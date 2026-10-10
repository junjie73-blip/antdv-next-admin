import { existsSync, promises as fs, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** 默认忽略的目录：脚本扫全仓时这几类一定会带来噪音与性能问题 */
const DEFAULT_IGNORED_DIRS = [
  '.git',
  '.nitro',
  '.output',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
];

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** 同步版：vite 配置求值阶段只能同步读盘 */
function pathExistsSync(target: string): boolean {
  try {
    return existsSync(target);
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function readTextFile(
  filePath: string,
  fallback = '',
): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

/**
 * 同步读文本，缺失/不可读时返回 fallback 而不是抛错。
 * 构建配置里读 loading.html、.env 这类可选文件，崩掉整个 vite 启动没有意义。
 */
function readTextFileSync(filePath: string, fallback = ''): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

async function writeTextFile(filePath: string, content: string) {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

/** JSON 读取失败要能降级：坏配置与缺配置在脚本语义里都该走 fallback */
async function readJsonFile<T = unknown>(
  filePath: string,
  fallback?: null | T | undefined,
): Promise<null | T | undefined> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

/** 写 JSON：自动建目录、固定 2 空格缩进、补尾换行，避免每次 diff 全是噪音 */
async function writeJsonFile(
  filePath: string,
  data: unknown,
  spaces = 2,
): Promise<void> {
  await ensureDir(dirname(filePath));
  await fs.writeFile(
    filePath,
    `${JSON.stringify(data, null, spaces)}\n`,
    'utf8',
  );
}

export interface WalkFilesOptions {
  /** 只保留这些后缀（含点）；省略表示全收 */
  extensions?: string[];
  /** 作用于 POSIX 相对路径，返回 false 则排除 */
  filter?: (relativePath: string) => boolean;
  /** 覆盖默认忽略目录 */
  ignoredDirs?: string[];
}

/**
 * 递归列文件，返回相对 root 的 POSIX 路径并稳定排序。
 * 排序是刻意的：脚本产出（清单、快照）不该因为 readdir 顺序而抖。
 */
async function walkFiles(
  root: string,
  options: WalkFilesOptions = {},
): Promise<string[]> {
  const { extensions, filter, ignoredDirs = DEFAULT_IGNORED_DIRS } = options;
  const results: string[] = [];

  async function walk(current: string, relative: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRelative = relative ? join(relative, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (ignoredDirs.includes(entry.name)) continue;
        await walk(join(current, entry.name), childRelative);
        continue;
      }
      if (!entry.isFile()) continue;
      const normalized = childRelative.split('\\').join('/');
      if (extensions && !extensions.some((ext) => normalized.endsWith(ext)))
        continue;
      if (filter && !filter(normalized)) continue;
      results.push(normalized);
    }
  }

  await walk(root, '');
  return results.sort();
}

/** 递归拷贝，filter 作用在每一层的条目名上，方便排除嵌套的 node_modules */
async function copyPath(
  source: string,
  target: string,
  filter?: (name: string) => boolean,
): Promise<void> {
  const stat = await fs.stat(source);
  if (!stat.isDirectory()) {
    await ensureDir(dirname(target));
    await fs.copyFile(source, target);
    return;
  }
  await ensureDir(target);
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (filter && !filter(entry.name)) continue;
    await copyPath(join(source, entry.name), join(target, entry.name), filter);
  }
}

/** rm -rf 语义且幂等：清理阶段的"目录本来就不存在"不是错误 */
async function removePath(target: string): Promise<void> {
  await fs.rm(target, { force: true, recursive: true });
}

/* ------------------------------- 兼容旧 API ------------------------------- */

export async function outputJSON(
  filePath: string,
  data: any,
  spaces: number = 2,
) {
  try {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const jsonData = JSON.stringify(data, null, spaces);
    await fs.writeFile(filePath, jsonData, 'utf8');
  } catch (error) {
    console.error('Error writing JSON file:', error);
    throw error;
  }
}

export async function ensureFile(filePath: string) {
  try {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, '', { flag: 'a' });
  } catch (error) {
    console.error('Error ensuring file:', error);
    throw error;
  }
}

export async function readJSON(filePath: string) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON file:', error);
    throw error;
  }
}

export {
  copyPath,
  ensureDir,
  isDirectory,
  pathExists,
  pathExistsSync,
  readJsonFile,
  readTextFile,
  readTextFileSync,
  removePath,
  walkFiles,
  writeJsonFile,
  writeTextFile,
};
