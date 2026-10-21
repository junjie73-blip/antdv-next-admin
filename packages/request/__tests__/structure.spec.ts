import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as api from '../src';

// barrel 里的 fetcher 只在报错时用 toast；把 popup-ui 的组件依赖图挡在单测之外
vi.mock('@antdv/popup-ui', () => ({ toast: {} }));

const SRC_DIR = path.resolve(import.meta.dirname, '../src');

function sourceFiles() {
  return readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.ts'))
    .toSorted();
}

/**
 * 这个包的边界就是它不许知道的东西：凭证存哪、登录页在哪、退出要清哪些 store，
 * 全部通过 `configureRequest()` 由应用注入。一旦有人图省事在包里 `import pinia`，
 * 包就再也无法脱离应用单独复用，所以用文件级断言把门守住。
 */
describe('request 包边界', () => {
  it('src 根目录只有约定的这些文件', () => {
    expect(sourceFiles()).toStrictEqual([
      'error.ts',
      'executor.ts',
      'fetcher.ts',
      'http.ts',
      'index.ts',
      'runtime.ts',
      'timeout.ts',
      'types.ts',
      'url.ts',
      'useRequest.ts',
      'vue-query.ts',
    ]);
  });

  it('源码里不出现 pinia、应用别名路径和 import.meta.env', () => {
    const offenders = sourceFiles()
      .filter((file) => {
        if (file === 'index.ts') return false;
        const text = readFileSync(path.join(SRC_DIR, file), 'utf8');
        return /from 'pinia'|from '~\/|import\.meta\.env\.|antdv-next/.test(
          text,
        );
      })
      .toSorted();

    expect(offenders).toStrictEqual([]);
  });

  it('对外暴露请求入口与注入点', () => {
    expect(Object.keys(api).toSorted()).toStrictEqual(
      [
        'AUTHORIZATION_KEY',
        'ErrorCode',
        'RequestError',
        'configureRequest',
        'createFetcher',
        'executeRequest',
        'forceLogout',
        'getRequestRuntime',
        'http',
        'isAuthEndpoint',
        'isLoggingOutNow',
        'isServerErrorCode',
        'isServerFailure',
        'loginPathOfRuntime',
        'refreshAccessToken',
        'request',
        'requestCache',
        'resetLogoutFlag',
        'resetRequestRuntime',
        'resolveErrorMessage',
        'useRequest',
      ].toSorted(),
    );
  });
});
