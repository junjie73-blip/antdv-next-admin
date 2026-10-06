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
 * - 全部颜色/尺寸使用 CSS 变量 + fallback，配合插件 autoTheme 自动主题
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

      /* 背景：优先使用应用主题变量，退化到中性灰 */
      background: var(
        --color-bg-layout,
        var(--color-bg-container, #f4f7f9)
      );

      /* 与插件 fadeDuration 默认值保持同步 */
      transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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
      background: var(--color-primary, #007bff);
      animation: app-loading-shadow 0.5s linear infinite;
    }

    .app-loading__loader::after {
      top: 0;
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background: var(--color-primary, #007bff);
      animation: app-loading-jump 0.5s linear infinite;
    }

    /* ==================== 标题 ==================== */
    .app-loading__title {
      margin-top: 66px;

      font-size: 32px;
      font-weight: 700;
      letter-spacing: 1px;

      /* 渐变文字：使用主色到主色 hover 色的过渡 */
      background: linear-gradient(
        135deg,
        var(--color-primary, #007bff) 0%,
        var(--color-primary-hover, #40a9ff) 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent; /* 兜底：不支持 -webkit-text-fill-color 时也不会露出黑字 */

      /* 未启用渐变时的降级色 */
      color: var(--color-text, rgba(0, 0, 0, 0.85));
    }

    /* ==================== 暗色模式适配 ==================== */
    /* 场景一：应用通过 html.dark 切换主题 */
    html.dark .app-loading {
      background: var(
        --color-bg-layout,
        var(--color-bg-container, #0d0d10)
      );
    }

    html.dark .app-loading__title {
      background: linear-gradient(
        135deg,
        #ffffff 0%,
        var(--color-primary, #007bff) 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* 场景二：应用通过 [data-theme="dark"] 切换主题 */
    [data-theme='dark'] .app-loading {
      background: var(
        --color-bg-layout,
        var(--color-bg-container, #0d0d10)
      );
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
