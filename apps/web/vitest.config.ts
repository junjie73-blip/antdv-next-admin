import type { ConfigEnv, PluginOption, UserConfig } from 'vite';

import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import appViteConfig from './vite.config';

/**
 * 单测配置复用应用的 vite 配置（别名、vue/jsx、auto-import、components 解析…），
 * 避免"应用能跑、测试里组件全未注册"这种两套配置漂移的问题。
 *
 * 但 `defineApplicationConfig` 导出的是**异步函数**，`mergeConfig` 不接受回调，
 * 必须先按 `mode: 'test'` 求值一次：此时 `loadEnv('test')` 只读 `.env`，
 * 里面的 `VITE_MOCK=false` 保证测试不会顺手把 Nitro Mock 服务拉起来。
 */
const SKIP_PLUGINS = new Set([
  // 构建期产物相关，测试里只会拖慢启动
  'vite-plugin-compression',
  'vite:archiver',
  'vite:metadata',
  'vite:mock-server',
  'vite:visualizer',
]);

/** 递归剔除：插件数组里可能出现 `Plugin[]`、假值（条件插件）和嵌套数组 */
function prunePlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins
    .flat(Infinity)
    .filter(Boolean)
    .map((plugin) => {
      if (Array.isArray(plugin)) return prunePlugins(plugin);
      const name = (plugin as { name?: string }).name;
      return name && SKIP_PLUGINS.has(name) ? undefined : plugin;
    })
    .filter(Boolean) as PluginOption[];
}

export default defineConfig(async () => {
  const env: ConfigEnv = {
    command: 'serve',
    isSsrBuild: false,
    isPreview: false,
    mode: 'test',
  };
  const resolved = ((await appViteConfig(env)) ?? {}) as UserConfig;

  return mergeConfig(
    { ...resolved, plugins: prunePlugins((resolved.plugins ?? []) as PluginOption[]) },
    defineConfig({
      test: {
        environment: 'jsdom',
        // 与仓库根 `vitest run --dom` 保持一致：用例里直接写 describe/it，不逐个 import
        globals: true,
        exclude: [...configDefaults.exclude, 'e2e/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
        setupFiles: ['./test/setup.ts'],
      },
    }),
  );
});
