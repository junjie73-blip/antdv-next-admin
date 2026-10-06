import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite';

import type { AppLoadingOptions } from './types';

import { join } from 'node:path';

import { pathExistsSync, readTextFileSync } from '@antdv/node-utils';

import { DEFAULT_LOADING_HTML } from '../defaults/loading-html';
import { DEFAULT_OPTIONS } from './constants';
import { scanCssVariables } from './css-variables';
import { injectLoadingHtml, resolveLoadingHtml } from './html-injector';
import { generateThemeStyle } from './theme';
import { resolveVirtualModule } from './virtual-module';

export function vitePluginAppLoading(
  userOptions: AppLoadingOptions = {},
): Plugin {
  const options = resolveOptions(userOptions);

  let config: ResolvedConfig;
  let loadingHtmlContent: string;
  let themeStyle: string = '';

  const virtualModuleId = options.virtualModuleId;
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: 'vite-plugin-app-loading',

    async configResolved(resolvedConfig) {
      config = resolvedConfig;
      const isDev = config.command === 'serve';
      if (isDev && !options.devEnabled) return;
      if (!isDev && !options.buildEnabled) return;

      // 1. 加载 HTML 内容
      const rawHtml = loadLoadingHtml(options);
      loadingHtmlContent = resolveLoadingHtml(
        rawHtml,
        config,
        options.htmlVariables,
      );
      // 2. 若开启自动主题，扫描并生成主题样式
      if (options.autoTheme) {
        const scanned = await scanCssVariables({
          root: config.root,
          sources: options.cssVariableSources,
          prefix: options.cssVariablePrefix,
          exclude: options.cssVariableExclude,
        });

        // 手动变量覆盖扫描结果
        const merged = { ...scanned, ...options.themeVariables };

        themeStyle = generateThemeStyle(merged, {
          selector: options.themeSelector,
          important: options.themeImportant,
        });

        if (config.command === 'serve' && Object.keys(merged).length > 0) {
          config.logger.info(
            `[vite-plugin-app-loading] 已注入 ${Object.keys(merged).length} 个 CSS 变量作为 loading 主题`,
          );
        }
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string, _ctx: IndexHtmlTransformContext) {
        const isDev = config.command === 'serve';
        if (isDev && !options.devEnabled) return html;
        if (!isDev && !options.buildEnabled) return html;

        // 将主题样式 + loading HTML 一并注入
        const payload =
          (themeStyle
            ? `<style data-app-loading-theme>${themeStyle}</style>`
            : '') + loadingHtmlContent;

        return injectLoadingHtml(html, payload, options);
      },
    },

    resolveId(id: string) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },

    load(id: string) {
      if (id === resolvedVirtualModuleId) return resolveVirtualModule(options);
    },
  };
}

function loadLoadingHtml(options: Required<AppLoadingOptions>): string {
  if (options.loadingHtml) return options.loadingHtml;

  if (options.loadingHtmlPath) {
    const resolved = join(process.cwd(), options.loadingHtmlPath);
    if (pathExistsSync(resolved)) return readTextFileSync(resolved);
    console.warn(
      `[vite-plugin-app-loading] loadingHtmlPath 未找到: ${resolved}，将使用内置模板`,
    );
  }

  // 内置模板直接来自 bundle 里的字符串常量：产物旁边没有 defaults/ 目录，
  // 任何 `__dirname` 文件读取在打包后都会失败
  return DEFAULT_LOADING_HTML;
}

function resolveOptions(
  userOptions: AppLoadingOptions,
): Required<AppLoadingOptions> {
  const env = (import.meta as any).env ?? {};

  const envDefaults: Partial<AppLoadingOptions> = {
    fadeDuration:
      env.VITE_APP_LOADING_DURATION == null
        ? undefined
        : Number(env.VITE_APP_LOADING_DURATION),
    devEnabled:
      env.VITE_APP_LOADING_DEV == null
        ? undefined
        : env.VITE_APP_LOADING_DEV === 'true',
    buildEnabled:
      env.VITE_APP_LOADING_BUILD == null
        ? undefined
        : env.VITE_APP_LOADING_BUILD === 'true',
  };

  // 优先级：userOptions > env > DEFAULT_OPTIONS
  return {
    ...DEFAULT_OPTIONS,
    ...stripUndefined(envDefaults),
    ...userOptions,
    cssVariableSources:
      userOptions.cssVariableSources ?? DEFAULT_OPTIONS.cssVariableSources,
    cssVariableExclude:
      userOptions.cssVariableExclude ?? DEFAULT_OPTIONS.cssVariableExclude,
    themeVariables: {
      ...DEFAULT_OPTIONS.themeVariables,
      ...userOptions.themeVariables,
    },
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
