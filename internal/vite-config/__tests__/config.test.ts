import { describe, expect, it } from 'vitest';

import {
  createAliases,
  createApplicationBuildConfig,
  createCommonConfig,
  createOptimizeDeps,
} from '../src/config';
import { isEnvEnabled } from '../src/utils/env';

/**
 * 开关判定的回归用例。
 *
 * 起因：`.env` 的值经过 `parseLoadedEnv` 会做类型转换（`'true' → true`、`'6080' → 6080`），
 * 而旧代码写的是 `envConfig.VITE_DEV_POLLING === 'true'`，恒为 false，
 * 导致映射盘上唯一能救命的 `VITE_DEV_POLLING` 从来没生效过。
 * 反过来 `if (envConfig.VITE_X)` 也不可信：`'0'` 不会被转成数字，仍是真值字符串。
 */
describe('isEnvEnabled', () => {
  it('认布尔、数字 1 和各种"开"的字符串写法', () => {
    for (const value of [
      true,
      1,
      '1',
      'ON',
      'true',
      'TRUE',
      'True',
      ' true ',
      'yes',
    ]) {
      expect(isEnvEnabled(value), `${String(value)} 应当算开启`).toBe(true);
    }
  });

  it('其余一律算关闭（含 "0" 这种字符串真值）', () => {
    for (const value of [
      false,
      0,
      '0',
      'no',
      'off',
      'false',
      '',
      '   ',
      undefined,
      null,
      {},
      [],
    ]) {
      expect(isEnvEnabled(value), `${String(value)} 应当算关闭`).toBe(false);
    }
  });
});

describe('createAliases', () => {
  it('默认给出 ~ → src、# → types，与 tsconfig paths 对齐', () => {
    expect(createAliases('/app')).toEqual({
      '#': '/app/types',
      '~': '/app/src',
    });
  });

  it('extra 可以覆盖默认别名（例如把 ~ 指到别处）', () => {
    expect(createAliases('/app', { '~': '/app/lib' })).toEqual({
      '#': '/app/types',
      '~': '/app/lib',
    });
  });
});

describe('createCommonConfig', () => {
  const config = createCommonConfig({
    envConfig: {},
    mode: 'production',
    root: '/app',
  });

  it('root 与 envDir 都指向消费方目录', () => {
    expect(config.root).toBe('/app');
    expect(config.envDir).toBe('/app');
    expect(config.cacheDir).toBe('node_modules/.vite');
  });

  it('vue / vue-router / pinia 强制单例', () => {
    expect(config.resolve?.dedupe).toEqual(
      expect.arrayContaining(['vue', 'vue-router', 'pinia']),
    );
  });

  it('dev 下开 CSS sourcemap，样式能定位到源文件', () => {
    expect(config.css).toMatchObject({ devSourcemap: true });
  });
});

describe('createApplicationBuildConfig', () => {
  it('生产构建丢掉 console / debugger', () => {
    const build = createApplicationBuildConfig(true);
    const output = (build?.rolldownOptions as any)?.output;
    expect(output.minify.compress).toEqual({
      dropConsole: true,
      dropDebugger: true,
    });
  });

  it('开发构建保留 console / debugger', () => {
    const build = createApplicationBuildConfig(false);
    const output = (build?.rolldownOptions as any)?.output;
    expect(output.minify.compress).toEqual({
      dropConsole: false,
      dropDebugger: false,
    });
  });

  it('产物按 js / assets 分目录，vendor 分包带 debugName 与最小体积', () => {
    const build = createApplicationBuildConfig(true);
    const output = (build?.rolldownOptions as any)?.output;
    expect(output.chunkFileNames).toBe('js/[name]-[hash].js');
    expect(output.entryFileNames).toBe('js/[name]-[hash].js');
    expect(output.assetFileNames).toBe('assets/[name]-[hash].[ext]');
    expect(output.codeSplitting.minSize).toBe(20 * 1024);
    expect(output.codeSplitting.groups[0].debugName).toBe('antdv-vendor');
    expect(build?.sourcemap).toBe(false);
    expect(build?.chunkSizeWarningLimit).toBe(1000);
  });

  it('分包规则把重依赖各自隔离，命中长期缓存', () => {
    const build = createApplicationBuildConfig(true);
    const group = (build?.rolldownOptions as any)?.output.codeSplitting
      .groups[0];
    const nameOf = (id: string) => group.name(id);

    expect(nameOf('/node_modules/antdv-next/es/button/index.js')).toBe(
      'vendor-ui',
    );
    expect(nameOf('/node_modules/pinia/dist/pinia.mjs')).toBe('vendor-vue');
    expect(nameOf('/node_modules/echarts/lib/echarts.js')).toBe(
      'vendor-echarts',
    );
    expect(nameOf('/node_modules/pdfjs-dist/build/pdf.mjs')).toBe(
      'vendor-pdfjs',
    );
    // 业务代码不参与 vendor 分组
    expect(nameOf('/src/views/dashboard/index.vue')).toBeUndefined();
  });
});

describe('createOptimizeDeps', () => {
  it('vue 不预打包，常用大包显式 include', () => {
    const deps = createOptimizeDeps();
    expect(deps?.exclude).toEqual(['vue']);
    expect(deps?.include).toEqual(
      expect.arrayContaining(['@vueuse/core', 'antdv-next', 'es-toolkit']),
    );
    // 裸 scope 名不是真实包，Vite 会报 "Failed to resolve dependency"
    expect(deps?.include).not.toContain('@vueuse');
  });
});
