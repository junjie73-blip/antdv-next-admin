import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fileShortHash,
  hashFile,
  hashObject,
  hashString,
  shortHash,
  stableStringify,
} from '../src/hash';

describe('stableStringify', () => {
  it('键顺序不同也得到同一字符串', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stableStringify({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it('undefined 与缺键等价', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(
      stableStringify({ a: 1 }),
    );
  });

  it('数组顺序参与哈希', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe('hash', () => {
  it('同一输入稳定，不同算法长度不同', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc', { algorithm: 'md5' })).toHaveLength(32);
    expect(hashString('abc')).toHaveLength(64);
  });

  it('hashObject 与 stableStringify 口径一致', () => {
    expect(hashObject({ x: 1, y: 2 })).toBe(hashObject({ y: 2, x: 1 }));
  });

  it('shortHash 截断', () => {
    expect(shortHash('abcdefghij')).toBe('abcdefgh');
  });
});

describe('hashFile', () => {
  it('读文件内容算哈希，并与同内容字符串一致', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'node-utils-hash-'));
    const file = join(dir, 'a.txt');
    await writeFile(file, 'abc', 'utf8');

    expect(await hashFile(file)).toBe(hashString('abc'));
    expect(await fileShortHash(file)).toHaveLength(8);
  });
});
