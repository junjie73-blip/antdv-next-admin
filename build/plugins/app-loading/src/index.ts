import type { Plugin, ResolvedConfig, IndexHtmlTransformContext } from 'vite'

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import type { AppLoadingOptions } from './types'

import { DEFAULT_OPTIONS } from './constants'
import { scanCssVariables } from './css-variables'
import { injectLoadingHtml, resolveLoadingHtml } from './html-injector'
import { generateThemeStyle } from './theme'
import { resolveVirtualModule } from './virtual-module'

export function vitePluginAppLoading(userOptions: AppLoadingOptions = {}): Plugin {
  const options = resolveOptions(userOptions)

  let config: ResolvedConfig
  let loadingHtmlContent: string
  let themeStyle: string = ''

  const virtualModuleId = options.virtualModuleId
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'vite-plugin-app-loading',

    async configResolved(resolvedConfig) {
      config = resolvedConfig
      const isDev = config.command === 'serve'
      if (isDev && !options.devEnabled) return
      if (!isDev && !options.buildEnabled) return

      // 1. 加载 HTML 内容
      const rawHtml = loadLoadingHtml(options)
      loadingHtmlContent = resolveLoadingHtml(rawHtml, config, options.htmlVariables)
      // 2. 若开启自动主题，扫描并生成主题样式
      if (options.autoTheme) {
        const scanned = await scanCssVariables({
          root: config.root,
          sources: options.cssVariableSources,
          prefix: options.cssVariablePrefix,
          exclude: options.cssVariableExclude,
        })

        // 手动变量覆盖扫描结果
        const merged = { ...scanned, ...options.themeVariables }

        themeStyle = generateThemeStyle(merged, {
          selector: options.themeSelector,
          important: options.themeImportant,
        })

        if (config.command === 'serve' && Object.keys(merged).length > 0) {
          config.logger.info(
            `[vite-plugin-app-loading] 已注入 ${Object.keys(merged).length} 个 CSS 变量作为 loading 主题`,
          )
        }
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string, _ctx: IndexHtmlTransformContext) {
        const isDev = config.command === 'serve'
        if (isDev && !options.devEnabled) return html
        if (!isDev && !options.buildEnabled) return html

        // 将主题样式 + loading HTML 一并注入
        const payload = (themeStyle ? `<style data-app-loading-theme>${themeStyle}</style>` : '') + loadingHtmlContent

        return injectLoadingHtml(html, payload, options)
      },
    },

    resolveId(id: string) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },

    load(id: string) {
      if (id === resolvedVirtualModuleId) return resolveVirtualModule(options)
    },
  }
}

function loadLoadingHtml(options: Required<AppLoadingOptions>): string {
  if (options.loadingHtml) return options.loadingHtml

  if (options.loadingHtmlPath) {
    const resolved = join(process.cwd(), options.loadingHtmlPath)
    if (existsSync(resolved)) return readFileSync(resolved, 'utf-8')
    console.warn(`[vite-plugin-app-loading] loadingHtmlPath 未找到: ${resolved}，将使用内置模板`)
  }

  const defaultPath = join(__dirname, 'defaults', 'loading.html')
  return existsSync(defaultPath) ? readFileSync(defaultPath, 'utf-8') : FALLBACK_LOADING_HTML
}

/** 内置回退模板：使用常见 CSS 变量，全部带 fallback 值 */
const FALLBACK_LOADING_HTML = `
<div id="__app-loading__" class="app-loading">
  <div class="app-loading__spinner"></div>
  <div class="app-loading__title"><%= VITE_APP_TITLE %></div>
</div>
<style>
  .app-loading {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: var(--color-bg-layout, var(--color-bg-container, #f4f7f9));
    color: var(--color-text, rgba(0, 0, 0, 0.85));
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .app-loading__spinner {
    width: 48px; height: 48px;
    border: 4px solid var(--color-border, rgba(0, 0, 0, 0.1));
    border-top-color: var(--color-primary, #1677ff);
    border-radius: 50%;
    animation: app-loading-spin 0.8s linear infinite;
  }
  @keyframes app-loading-spin { to { transform: rotate(360deg); } }
  .app-loading__title {
    margin-top: 16px; font-size: 16px; font-weight: 600;
    letter-spacing: 1px;
  }
  /* 暗色模式：如果应用通过 .dark 类切换主题 */
  .dark .app-loading {
    background: var(--color-bg-layout, #0d0d10);
    color: var(--color-text, #fff);
  }
</style>
`
function resolveOptions(userOptions: AppLoadingOptions): Required<AppLoadingOptions> {
  const env = (import.meta as any).env ?? {}

  const envDefaults: Partial<AppLoadingOptions> = {
    fadeDuration: env.VITE_APP_LOADING_DURATION != null ? Number(env.VITE_APP_LOADING_DURATION) : undefined,
    devEnabled: env.VITE_APP_LOADING_DEV != null ? env.VITE_APP_LOADING_DEV === 'true' : undefined,
    buildEnabled: env.VITE_APP_LOADING_BUILD != null ? env.VITE_APP_LOADING_BUILD === 'true' : undefined,
  }

  // 优先级：userOptions > env > DEFAULT_OPTIONS
  return {
    ...DEFAULT_OPTIONS,
    ...stripUndefined(envDefaults),
    ...userOptions,
    cssVariableSources: userOptions.cssVariableSources ?? DEFAULT_OPTIONS.cssVariableSources,
    cssVariableExclude: userOptions.cssVariableExclude ?? DEFAULT_OPTIONS.cssVariableExclude,
    themeVariables: {
      ...DEFAULT_OPTIONS.themeVariables,
      ...userOptions.themeVariables,
    },
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
