/**
 * vite-plugin-app-loading 默认 Loading 模板。
 *
 * 为什么是字符串常量而不是 defaults/loading.html：
 * vite-config 会被 tsdown 打成单个 dist/index.mjs，产物旁边并不存在 defaults/ 目录，
 * 运行时用 `__dirname` 去读文件必然抛 `ReferenceError / ENOENT`；
 * 内联进 bundle 才是「被打包消费的包」应有的做法，也保证模板与代码一起版本化。
 *
 * - 由插件在 transformIndexHtml 阶段注入到 index.html
 * - 支持 `<%= VITE_APP_TITLE %>` 等 HTML 环境变量（由 vite-plugin-html 处理）
 * - 颜色一律走三级链：`--loading-*`（首屏脚本从主题快照写入）→ `--app-*`（`@antdv/design`
 *   的色板，应用样式生效后接手）→ 按明暗分档的兜底色
 * - `<style>` 内联在容器内部，随容器一起移除，不产生样式残留
 */
export const DEFAULT_LOADING_HTML = `<!--
  vite-plugin-app-loading 默认 Loading 模板
  ------------------------------------------------------------
  - 由插件在 transformIndexHtml 阶段注入到 index.html
  - 支持 <%= VITE_APP_TITLE %> 等 HTML 环境变量（由 vite-plugin-html 处理）
  - 全部颜色/尺寸使用 CSS 变量 + fallback，配合插件 autoTheme 自动主题
  - <style> 内联在容器内部，随容器一起移除，不产生样式残留
-->
<div id="__app-loading__" class="app-loading">
  <div class="app-loading__loader"></div>
  <div class="app-loading__title"><%= VITE_APP_TITLE %></div>

  <style>
    /* ==================== 基础重置（仅作用于 loading 生效期间） ==================== */
    html {
      line-height: 1.15;
    }

    /* ==================== Loading 容器 ==================== */
    .app-loading {
      position: fixed;
      inset: 0;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      /*
       * 三条颜色的取值顺序：
       * 1. --loading-* —— head 里的主题同步脚本按 localStorage 的主题快照写入，
       *    覆盖"应用样式还没落地"的那几百毫秒；
       * 2. --app-* —— @antdv/design 的色板，样式表一进来就由它接手（含预设主题与深色档）；
       * 3. 兜底 —— 首次访问、没有快照时按当前明暗各给一个实色，避免出现出厂蓝。
       */
      --app-loading-bg: var(
        --loading-background,
        var(--app-background, #fff)
      );
      --app-loading-fg: var(
        --loading-foreground,
        var(--app-foreground, rgb(0 0 0 / 88%))
      );
      --app-loading-primary: var(--loading-primary, var(--app-primary, #1677ff));

      background: var(--app-loading-bg);

      /* 与插件 fadeDuration 默认值保持同步 */
      transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 没有快照时，深色档的兜底由这条规则给（有快照时上面那条已经是对的） */
    html.dark .app-loading,
    [data-theme='dark'] .app-loading {
      --app-loading-bg: var(
        --loading-background,
        var(--app-background, #141414)
      );
      --app-loading-fg: var(
        --loading-foreground,
        var(--app-foreground, rgb(255 255 255 / 85%))
      );
    }

    /* 隐藏状态（可选，插件使用内联样式直接修改 opacity，这里是备用 API） */
    .app-loading.is-hidden {
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }

    /* ==================== 加载器（方块跳跃动画） ==================== */
    .app-loading__loader {
      position: relative;
      width: 48px;
      height: 48px;
    }

    .app-loading__loader::before,
    .app-loading__loader::after {
      content: '';
      position: absolute;
      left: 0;
    }

    .app-loading__loader::before {
      top: 60px;
      width: 48px;
      height: 5px;
      border-radius: 50%;
      background: var(--app-loading-primary);
      animation: app-loading-shadow 0.5s linear infinite;
    }

    .app-loading__loader::after {
      top: 0;
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background: var(--app-loading-primary);
      animation: app-loading-jump 0.5s linear infinite;
    }

    /* ==================== 标题 ==================== */
    .app-loading__title {
      margin-top: 66px;

      font-size: 32px;
      font-weight: 700;
      letter-spacing: 1px;

      /* 渐变文字：主色 → 主色掺白，第二档由 color-mix 现算，不再依赖额外的变量名 */
      background: linear-gradient(
        135deg,
        var(--app-loading-primary) 0%,
        color-mix(in srgb, var(--app-loading-primary) 65%, #fff) 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent; /* 兜底：不支持 -webkit-text-fill-color 时也不会露出黑字 */

      /* 未启用渐变时的降级色 */
      color: var(--app-loading-fg);
    }

    /* ==================== 暗色模式适配 ==================== */
    /* 深色下渐变换成"白 → 主色"，纯主色文字在深底上对比度不够 */
    html.dark .app-loading__title,
    [data-theme='dark'] .app-loading__title {
      background: linear-gradient(
        135deg,
        #fff 0%,
        var(--app-loading-primary) 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* ==================== 动画关键帧 ==================== */
    @keyframes app-loading-jump {
      15% {
        border-bottom-right-radius: 3px;
      }
      25% {
        transform: translateY(9px) rotate(22.5deg);
      }
      50% {
        border-bottom-right-radius: 40px;
        transform: translateY(18px) scaleY(0.9) rotate(45deg);
      }
      75% {
        transform: translateY(9px) rotate(67.5deg);
      }
      to {
        transform: translateY(0) rotate(90deg);
      }
    }

    @keyframes app-loading-shadow {
      0%,
      to {
        transform: scale(1);
      }
      50% {
        transform: scaleX(1.2);
      }
    }

    /* ==================== 无障碍：尊重用户动效偏好 ==================== */
    @media (prefers-reduced-motion: reduce) {
      .app-loading__loader::before,
      .app-loading__loader::after {
        animation-duration: 1.5s;
      }
      .app-loading {
        transition-duration: 0.2s;
      }
    }
  </style>
</div>
`;
