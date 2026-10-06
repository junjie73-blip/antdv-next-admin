export interface AppLoadingOptions {
  /** 自定义 loading HTML 文件路径（相对应用根目录）；省略时使用插件内置模板 */
  loadingHtmlPath?: string

  /** 或直接传入 HTML 字符串内容（优先级高于 loadingHtmlPath） */
  loadingHtml?: string

  /** 注入到 HTML 中的位置，默认 'body-prepend' */
  injectPosition?: 'body-prepend' | 'body-append' | 'head-prepend' | 'head-append'

  /** loading 容器的 CSS 选择器，默认为 '#__app-loading__' */
  containerSelector?: string

  /** 消失动画的时长（毫秒），默认 600 */
  fadeDuration?: number

  /** 消失动画的 CSS transition 属性，默认 'opacity' */
  fadeProperty?: string

  /** 是否在开发环境中启用，默认 true */
  devEnabled?: boolean

  /** 是否在生产环境中启用，默认 true */
  buildEnabled?: boolean

  /** 是否自动移除 loading（在 DOMContentLoaded 时），默认 false */
  autoRemove?: boolean

  /** 自动移除的延迟时间（毫秒），仅在 autoRemove 为 true 时生效，默认 0 */
  autoRemoveDelay?: number

  /** 自定义虚拟模块 ID，默认 'virtual:app-loading' */
  virtualModuleId?: string

  /* ========== CSS 变量自动主题 ========== */
  /** 是否从项目 CSS 文件中自动提取 CSS 变量用于 loading 主题，默认 true */
  autoTheme?: boolean

  /** 扫描 CSS 变量的 glob 匹配（相对项目根目录） */
  cssVariableSources?: string[]

  /** 仅提取指定前缀的 CSS 变量，例如 '--app-'，不传则全部提取 */
  cssVariablePrefix?: string

  /** 排除匹配的变量名 */
  cssVariableExclude?: RegExp[]

  /** 手动覆盖/补充的 CSS 变量（优先级最高） */
  themeVariables?: Record<string, string>

  /** 注入主题变量的选择器，默认 ':root' */
  themeSelector?: string

  /** 是否在变量声明中保留 !important（默认 false，避免压过应用主题） */
  themeImportant?: boolean
  htmlVariables?: Record<string, string>
}
