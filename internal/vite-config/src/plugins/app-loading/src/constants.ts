import type { AppLoadingOptions } from './types';

export const DEFAULT_OPTIONS: Required<AppLoadingOptions> = {
  /* ==================== 基础配置 ==================== */
  // 默认不指定自定义 loading 文件，使用插件内置模板
  loadingHtmlPath: '',

  // 默认不传入 HTML 字符串
  loadingHtml: '',

  // 默认注入到 <body> 起始位置，确保在应用挂载前即可见
  injectPosition: 'body-prepend',

  // 默认 loading 容器选择器，与内置模板保持一致
  containerSelector: '#__app-loading__',

  // 默认淡出时长 600ms，与内置 CSS transition 一致
  fadeDuration: 600,

  // 默认通过 opacity 做淡出
  fadeProperty: 'opacity',

  // 开发与生产环境均默认启用
  devEnabled: true,
  buildEnabled: true,

  // 默认不自动移除，由应用主动调用 loadingFadeOut()
  autoRemove: false,
  autoRemoveDelay: 0,

  // 虚拟模块 ID，用户可自定义以避免冲突
  virtualModuleId: 'virtual:app-loading',

  /* ==================== CSS 变量自动主题 ==================== */
  // 默认开启自动主题
  autoTheme: true,

  // 默认扫描常见样式扩展名（不含 node_modules / dist）
  cssVariableSources: [
    'src/**/*.css',
    'src/**/*.scss',
    'src/**/*.less',
    'src/**/*.sass',
    'src/**/*.styl',
  ],

  // 默认提取所有 CSS 变量
  cssVariablePrefix: '--',

  // 默认排除常见工具类前缀，避免污染主题
  // - --vite-*  : Vite 内部注入的变量
  // - --_*      : 部分 CSS-in-JS 库的内部变量
  cssVariableExclude: [/^--vite-/, /^--_/, /^--el-/, /^--un-/],

  // 默认无手动覆盖变量
  themeVariables: {},

  // 默认注入到 :root，全局可用
  themeSelector: ':root',

  // 默认不加 !important，保证应用样式加载后能覆盖内联值
  themeImportant: false,
  htmlVariables: {},
};
