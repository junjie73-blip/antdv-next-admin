import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  copyPath,
  ensureDir,
  isDirectory,
  pathExists,
  readJsonFile,
  readTextFile,
  removePath,
  walkFiles,
  writeJsonFile,
  writeTextFile,
} from '../src/fs'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'node-utils-fs-'))
  await ensureDir(join(dir, 'src/nested'))
  await ensureDir(join(dir, 'node_modules/pkg'))
  await writeFile(join(dir, 'src/index.ts'), 'export {}', 'utf8')
  await writeFile(join(dir, 'src/nested/deep.vue'), '<template/>', 'utf8')
  await writeFile(join(dir, 'src/index.css'), 'a{}', 'utf8')
  await writeFile(join(dir, 'node_modules/pkg/index.ts'), 'x', 'utf8')
  await writeFile(join(dir, 'package.json'), '{"name":"demo"}\n', 'utf8')
})

describe('JSON 读写', () => {
  it('缺失文件返回 fallback 而不是抛错', async () => {
    expect(await readJsonFile(join(dir, 'nope.json'), { a: 1 })).toEqual({ a: 1 })
    expect(await readJsonFile(join(dir, 'nope.json'))).toBeUndefined()
  })

  it('坏 JSON 同样走 fallback（脚本里配置损坏不该崩）', async () => {
    await writeFile(join(dir, 'bad.json'), '{oops', 'utf8')
    expect(await readJsonFile(join(dir, 'bad.json'), null)).toBeNull()
  })

  it('写入时自动建目录、补尾换行、2 空格缩进', async () => {
    const target = join(dir, 'out/deep/config.json')
    await writeJsonFile(target, { b: 2, a: 1 })
    const text = await readFile(target, 'utf8')
    expect(text).toBe('{\n  "b": 2,\n  "a": 1\n}\n')
  })

  it('读回刚写入的对象', async () => {
    await writeJsonFile(join(dir, 'pkg.json'), { name: 'x' })
    expect(await readJsonFile<{ name: string }>(join(dir, 'pkg.json'))).toEqual({
      name: 'x',
    })
  })
})

describe('文本与存在性', () => {
  it('readTextFile 缺失时返回空串', async () => {
    expect(await readTextFile(join(dir, 'missing.txt'))).toBe('')
    expect(await readTextFile(join(dir, 'package.json'))).toContain('demo')
  })

  it('pathExists / isDirectory', async () => {
    expect(await pathExists(join(dir, 'src'))).toBe(true)
    expect(await pathExists(join(dir, 'nope'))).toBe(false)
    expect(await isDirectory(join(dir, 'src'))).toBe(true)
    expect(await isDirectory(join(dir, 'package.json'))).toBe(false)
  })

  it('writeTextFile 会创建父目录', async () => {
    await writeTextFile(join(dir, 'a/b/c.txt'), 'hi')
    expect(await readFile(join(dir, 'a/b/c.txt'), 'utf8')).toBe('hi')
  })
})

describe('walkFiles', () => {
  it('默认跳过 node_modules 等目录', async () => {
    const files = await walkFiles(dir)
    expect(files).toContain('src/index.ts')
    expect(files.some((file) => file.includes('node_modules'))).toBe(false)
  })

  it('按后缀过滤', async () => {
    expect(await walkFiles(dir, { extensions: ['.ts'] })).toEqual(['src/index.ts'])
    expect(await walkFiles(dir, { extensions: ['.json'] })).toEqual(['package.json'])
  })

  it('filter 只作用于相对路径', async () => {
    const files = await walkFiles(dir, {
      extensions: ['.ts', '.vue'],
      filter: (rel) => !rel.includes('nested'),
    })
    expect(files).toEqual(['src/index.ts'])
  })

  it('返回 POSIX 相对路径且稳定排序', async () => {
    const files = await walkFiles(dir)
    expect(files).toEqual([...files].sort())
    expect(files.every((file) => !file.includes('\\'))).toBe(true)
  })
})

describe('copyPath / removePath', () => {
  it('目录递归拷贝并保留结构', async () => {
    const dest = join(dir, 'copy')
    await copyPath(join(dir, 'src'), dest)
    expect(await readFile(join(dest, 'nested/deep.vue'), 'utf8')).toBe('<template/>')
  })

  it('filter 作用于每一层的条目名', async () => {
    const dest = join(dir, 'copy2')
    await copyPath(join(dir, 'src'), dest, (name) => name !== 'nested')
    expect(await pathExists(join(dest, 'index.ts'))).toBe(true)
    expect(await pathExists(join(dest, 'nested'))).toBe(false)
  })

  it('removePath 幂等：不存在也不报错', async () => {
    await removePath(join(dir, 'src'))
    expect(await pathExists(join(dir, 'src'))).toBe(false)
    await expect(removePath(join(dir, 'src'))).resolves.toBeUndefined()
  })
})
