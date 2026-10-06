/**
 * 启动初始化插件
 *
 * 1. 把 nitro.config.ts 的 runtimeConfig.stateFile 注入 store（legacy 写死 mock/.runtime.json，
 *    新结构下持久化路径必须来自运行时配置，相对 server 进程 cwd 解析）；
 * 2. 预注册源码接口清单：Nitro 的 handler 模块是懒加载的，不在启动时补齐的话，
 *    面板在接口被命中前会看不到任何条目（legacy 由 fake-server 启动时全量加载保证这点）；
 * 3. 恢复生成接口的清单条目：定义持久化在 store 里，重启后仍需出现在面板中。
 */

import { defineNitroPlugin, useRuntimeConfig } from '#imports';

import { buildSourceManifest } from '../utils/registry';
import { generatedFileOf, moduleOf, splitKey } from '../utils/route-meta';
import {
  listGenerated,
  registerManifest,
  setPersistFile,
} from '../utils/store';

export default defineNitroPlugin(() => {
  // 先定路径再碰 store，避免首次 getStore() 读到错误的持久化文件
  setPersistFile(String(useRuntimeConfig().stateFile ?? '.mock-state.json'));

  registerManifest(buildSourceManifest());

  const generated = listGenerated();
  registerManifest(
    generated.map((item) => {
      const { method, path } = splitKey(item.key);
      return {
        duplicates: [],
        file: generatedFileOf(item.id),
        key: item.key,
        method,
        module: moduleOf(path),
        path,
        source: 'generated' as const,
        title: item.title,
      };
    }),
  );
});
