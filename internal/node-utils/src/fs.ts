import type { Dirent } from 'node:fs'

import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { DEFAULT_INDENT, IGNORED_DIRS } from './constants'
import { toPosixPath } from './path'

/** JSON 读失败时返回 fallback，而不是抛异常：脚本里「配置不存在」是正常分支 */
export async function readJsonFile<T = unknown>(
  filePath: string,
  fallback: T | undefined = undefined,
): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  options: { indent?: number } = {},
): Promise<void> {
  const indent = options.indent ?? DEFAULT_INDENT
  await ensureDir(dirname(filePath))
  // 结尾补一个换行，和仓库里所有 JSON 的 diff 习惯保持一致
  await writeFile(filePath, `${JSON.stringify(data, null, indent)}\n`, 'utf8')
}

export async function readTextFile(
  filePath: string,
  fallback = '',
): Promise<string> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return fallback
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, content, 'utf8')
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  } catch {
    return false
  }
}

/**
 * 同步版 `pathExists`。
 * 构建配置（vite.config / tsdown.config）与 Vite plugin 的 hook 里不能 await，
 * 这些调用点只需要同步判断。
 */
export function pathExistsSync(target: string): boolean {
  return existsSync(target)
}

/** 同步版 `readTextFile`：文件不存在 / 无权限时返回 fallback，而不是抛异常 */
export function readTextFileSync(filePath: string, fallback = ''): string {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return fallback
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/** 目录递归拷贝；`filter` 用于跳过 dist / node_modules 之类的产物 */
export async function copyPath(
  src: string,
  dest: string,
  filter?: (relativePath: string) => boolean,
): Promise<void> {
  const info = await stat(src)
  if (!info.isDirectory()) {
    await ensureDir(dirname(dest))
    await copyFile(src, dest)
    return
  }

  await ensureDir(dest)
  const entries = await readdir(src, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => (filter ? filter(entry.name) : true))
      .map((entry) =>
        copyPath(join(src, entry.name), join(dest, entry.name), filter),
      ),
  )
}

export async function removePath(target: string): Promise<void> {
  await rm(target, { force: true, recursive: true })
}

export interface WalkOptions {
  /** 需要保留的后缀（小写，含点）；不传表示所有文件 */
  extensions?: readonly string[]
  /** 命中的相对路径（POSIX）参与筛选，可用来排除测试目录 */
  filter?: (relativePath: string) => boolean
  /** 额外跳过的目录名 */
  ignore?: readonly string[]
}

/**
 * 递归收集文件，返回相对 `root` 的 POSIX 路径。
 *
 * 返回相对路径而不是绝对路径：调用方普遍要把结果写进 manifest 或做集合比较，
 * 绝对路径会让 Windows 与 Linux 的结果不可比。
 */
export async function walkFiles(
  root: string,
  options: WalkOptions = {},
): Promise<string[]> {
  const { extensions, filter, ignore = [] } = options
  const skip = new Set<string>([...IGNORED_DIRS, ...ignore])
  const base = resolve(root)
  const out: string[] = []

  const stack: Array<{ dir: string; prefix: string }> = [{ dir: base, prefix: '' }]

  while (stack.length) {
    const { dir, prefix } = stack.pop() as { dir: string; prefix: string }
    const entries: Dirent[] = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const absPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue
        stack.push({ dir: absPath, prefix: relPath })
        continue
      }

      if (!entry.isFile()) continue
      if (extensions?.length) {
        const lower = entry.name.toLowerCase()
        if (!extensions.some((ext) => lower.endsWith(ext))) continue
      }
      if (filter && !filter(relPath)) continue
      out.push(toPosixPath(relPath))
    }
  }

  return out.sort()
}
