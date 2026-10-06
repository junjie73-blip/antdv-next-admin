import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  extname,
  findRepoRoot,
  findRepoRootSync,
  fromPosixPath,
  isAbsolutePath,
  joinPosix,
  relativePosix,
  repoRelative,
  stripExtension,
  toPosixPath,
} from '../src/path'

describe('toPosixPath / fromPosixPath', () => {
  it('Windows 反斜杠统一成正斜杠', () => {
    expect(toPosixPath(String.raw`apps\web\src\index.ts`)).toBe('apps/web/src/index.ts')
    expect(toPosixPath('apps/web/src/index.ts')).toBe('apps/web/src/index.ts')
  })

  it('往返转换保持 POSIX 形式稳定', () => {
    const posix = 'internal/node-utils/src/index.ts'
    expect(toPosixPath(fromPosixPath(posix))).toBe(posix)
  })
})

describe('isAbsolutePath', () => {
  it('识别 POSIX 与 Windows 盘符两种绝对路径', () => {
    expect(isAbsolutePath('/usr/local')).toBe(true)
    expect(isAbsolutePath(String.raw`J:\antdv\frontend`)).toBe(true)
    expect(isAbsolutePath('apps/web')).toBe(false)
    expect(isAbsolutePath('../web')).toBe(false)
  })
})

describe('relativePosix', () => {
  it('仓库内路径返回相对 POSIX 路径', () => {
    expect(relativePosix('/repo', '/repo/apps/web/src/main.ts')).toBe(
      'apps/web/src/main.ts',
    )
  })

  it('根目录自身得到 .', () => {
    expect(relativePosix('/repo', '/repo')).toBe('.')
  })

  it('仓库外路径保留绝对形式，不产出 ../..', () => {
    expect(relativePosix('/repo/apps', '/other/place')).toBe('/other/place')
  })
})

describe('路径小工具', () => {
  it('joinPosix 输出正斜杠', () => {
    expect(joinPosix('a', 'b', 'c.ts')).toBe('a/b/c.ts')
  })

  it('stripExtension / extname 处理无后缀与隐藏文件', () => {
    expect(stripExtension('a/b/index.ts')).toBe('a/b/index')
    expect(stripExtension('a/b/index')).toBe('a/b/index')
    expect(extname('archive.tar.gz')).toBe('.gz')
    expect(extname('Makefile')).toBe('')
  })

  it('repoRelative 与 relativePosix 一致', () => {
    expect(repoRelative('/repo/apps/web', '/repo')).toBe('apps/web')
  })
})

describe('仓库根定位', () => {
  it('同步版与异步版结果一致（构建配置里只能同步调用）', async () => {
    expect(findRepoRootSync()).toBe(await findRepoRoot())
  })

  it('省略 repoRoot 时自动向上定位仓库根', async () => {
    const root = (await findRepoRoot()) as string
    expect(repoRelative(root)).toBe('.')
    expect(repoRelative(join(root, 'internal', 'node-utils'))).toBe(
      'internal/node-utils',
    )
  })

  it('仓库外的路径原样返回 POSIX 绝对路径，而不是抛异常', () => {
    expect(repoRelative('/repo/apps/web', '/elsewhere')).toContain('/')
  })
})
