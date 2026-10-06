import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256'

/**
 * 键排序后的 JSON 序列化。
 *
 * 直接 `JSON.stringify(obj)` 的结果依赖键插入顺序，
 * 而配置对象常常来自 spread 合并（`{ ...a, ...b }`），顺序不稳定；
 * 不做归一化就会给同一份配置算出多个 hash，缓存与 diff 全部失效。
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value))
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item))

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const item = record[key]
        // undefined 与「键不存在」在 JSON 里等价，显式丢掉避免顺序差异
        if (item !== undefined) acc[key] = normalize(item)
        return acc
      }, {})
  }

  return value
}

export function hashString(
  input: string,
  options: { algorithm?: HashAlgorithm } = {},
): string {
  const { algorithm = 'sha256' } = options
  return createHash(algorithm).update(input, 'utf8').digest('hex')
}

/** 二进制输入（Buffer / Uint8Array），编码参数对它无意义，单独走一条路径 */
function hashBuffer(
  input: Uint8Array,
  options: { algorithm?: HashAlgorithm } = {},
): string {
  const { algorithm = 'sha256' } = options
  return createHash(algorithm).update(input).digest('hex')
}

export function hashObject(
  value: unknown,
  options: { algorithm?: HashAlgorithm } = {},
): string {
  return hashString(stableStringify(value), options)
}

export async function hashFile(
  filePath: string,
  options: { algorithm?: HashAlgorithm } = {},
): Promise<string> {
  return hashBuffer(await readFile(filePath), options)
}

/** 取前 8 位，用于文件名 / 日志里展示 */
export function shortHash(hash: string, length = 8): string {
  return hash.slice(0, length)
}

export async function fileShortHash(
  filePath: string,
  length = 8,
): Promise<string> {
  return shortHash(await hashFile(filePath), length)
}
