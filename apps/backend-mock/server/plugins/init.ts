/**
 * 启动初始化插件
 *
 * 1. 把 nitro.config.ts 的 runtimeConfig.stateFile 注入 store（持久化路径来自运行时配置）；
 * 2. 预注册源码接口清单：Nitro 的 handler 模块是懒加载的，不在启动时补齐的话，
 *    接口清单在首次命中前看不到任何条目。
 *
 * 生成式自定义接口的注册已随「Mock 数据中心」下线移除。
 */

import { defineNitroPlugin, useRuntimeConfig } from '#imports';

import { buildSourceManifest } from '../utils/registry';
import { registerManifest, setPersistFile } from '../utils/store';

export default defineNitroPlugin(() => {
  // 先定路径再碰 store，避免首次 getStore() 读到错误的持久化文件
  setPersistFile(String(useRuntimeConfig().stateFile ?? '.mock-state.json'));

  registerManifest(buildSourceManifest());
});
