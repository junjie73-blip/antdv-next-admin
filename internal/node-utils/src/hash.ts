import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface HashOptions {
  /** md5 只用于内容指纹（非安全场景），校验用途请显式换 sha256 以上 */
  algorithm?: 'md5' | 'sha1' | 'sha256' | 'sha512';
  encoding?: BufferEncoding;
}

/**
 * 递归排序键的 JSON 序列化。
 * 对象字面量的键顺序由写入顺序决定，直接 JSON.stringify 会让"内容没变、
 * 只是键换了位置"的缓存/配置指纹每次都失配。
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      // undefined 与"缺键"在 JSON 语义里等价，统一掉
      if (item === undefined) continue;
      result[key] = normalize(item);
    }
    return result;
  }
  return value;
}

function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  return serialized === undefined ? 'null' : serialized;
}

function hashString(
  content: string,
  options: HashOptions = {},
): string {
  const { algorithm = 'sha256', encoding = 'utf8' } = options;
  return createHash(algorithm).update(content, encoding).digest('hex');
}

function hashObject(value: unknown, options: HashOptions = {}): string {
  return hashString(stableStringify(value), options);
}

/** 纯截断：用于把哈希压成日志里可读的短指纹 */
function shortHash(input: string, length = 8): string {
  return input.slice(0, length);
}

async function hashFile(
  filePath: string,
  options: HashOptions = {},
): Promise<string> {
  return hashString(await readFile(filePath, 'utf8'), options);
}

async function fileShortHash(filePath: string): Promise<string> {
  return shortHash(await hashFile(filePath));
}

/**
 * 生产基于内容的 hash，可自定义长度（md5）。
 * 保留给 vite 插件的产物命名，与新 API 的默认 sha256 口径分开。
 */
function generatorContentHash(content: string, hashLSize?: number) {
  const hash = createHash('md5').update(content, 'utf8').digest('hex');

  if (hashLSize) {
    return hash.slice(0, hashLSize);
  }

  return hash;
}

export {
  fileShortHash,
  generatorContentHash,
  hashFile,
  hashObject,
  hashString,
  shortHash,
  stableStringify,
};
