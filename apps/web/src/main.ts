import { createApp, nextTick } from 'vue';
import VuePdfEmbed, {
  GlobalWorkerOptions,
} from 'vue-pdf-embed/dist/index.essential.mjs';
import 'vue-pdf-embed/dist/styles/annotationLayer.css';
import 'vue-pdf-embed/dist/styles/textLayer.css';

import { vLoading } from '@antdv/ui/loading';
import FcDesigner from '@form-create/antd-designer';
import formCreate from '@form-create/antdv-next';
import install from '@form-create/antdv-next/auto-import';
import * as Sentry from '@sentry/vue';
import { MotionPlugin } from '@vueuse/motion';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createPinia } from 'pinia';
// 首屏 Loading 遮罩由 vite-plugin-app-loading 注入在 `#app` 之外（body-prepend），
// 插件刻意配成 autoRemove: false —— 挂载动作顶不掉它，必须由入口主动摘除，
// 否则遮罩会一直盖住整个页面并吞掉所有点击。
import { loadingFadeOut } from 'virtual:app-loading';

import App from './App.vue';
import { escapeDirective, safeHtmlDirective, vLazy, vPermission } from './directives';
import i18n from './locales';
import { registerVendorAntdComponents } from './plugins/vendor-antd-components';
import { setupRouter } from './router';
import { initSecuritySystem } from './utils/securityInit';

import './bootstrap/env';
import 'virtual:svg-icons-register';
/*
 * 全局样式来自 `@antdv/styles`（Tailwind 入口 + 基础层 + NProgress + 无障碍 + 权限降级），
 * 应用侧不再维护 global.css。
 */
import '@antdv/styles';

// 按需导入 form-create 组件
formCreate.use(install);
const app = createApp(App);
/**
 * 第三方预编译模板（表单设计器）在运行时按 `a-*` 名字找组件，编译期自动导入覆盖不到，
 * 不注册的话设计器整个外壳会渲染成空白标签。详见 `plugins/vendor-antd-components.ts`。
 */
registerVendorAntdComponents(app);
const pinia = createPinia();
app.use(pinia);
app.use(i18n);
app.use(formCreate);
app.use(FcDesigner);
app.use(MotionPlugin);

// 路由必须先装好：Sentry 的 browserTracingIntegration 要拿同一个 router 实例做路由追踪
const router = setupRouter(app);

if (import.meta.env.PROD) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration(),
    ] as unknown as NonNullable<
      Parameters<typeof Sentry.init>[0]
    >['integrations'],
    // Tracing
    tracesSampleRate: 1, // Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ['localhost', /^https:\/\/121.4.127.82\.io\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });
}

// ==================== 初始化安全防护系统 ====================
// 在应用启动时立即初始化 CSRF Token 和安全配置
initSecuritySystem({
  csrfHeaderName: 'X-CSRF-Token',
  enableDoubleSubmit: true,
  autoRotateToken: true,
});

// ==================== 全局注册安全防护指令 ====================
// v-safe-html: 安全渲染 HTML（自动过滤 XSS 攻击代码）
app.directive('safe-html', safeHtmlDirective);

// v-escape: 自动转义文本内容（防止注入攻击）
// 用法：v-escape="value" | v-escape:url="url" | v-escape:js="code"
app.directive('escape', escapeDirective);
// v-permission: 权限指令（根据用户角色判断是否显示）
app.directive('permission', vPermission);
// v-lazy: 图片懒加载（进视口才请求，失败回退、渐显、无 IntersectionObserver 时降级为立即加载）
app.directive('lazy', vLazy);
// v-loading: 元素级加载遮罩，配置从 loading-tip / loading-theme / loading-size 等属性读
app.directive('loading', vLoading);
// ==================== 全局注册组件 ====================
app.component('PdfViewer', VuePdfEmbed);
GlobalWorkerOptions.workerSrc = PdfWorker;
app.mount('#app');

/**
 * 首屏 Loading 遮罩挂在 `#app` 的兄弟位置，mount 只会替换 #app 的内容，碰不到它。
 * 等首帧真正渲染出去再淡出，避免"遮罩没了、页面还是白的"那一瞬。
 */
void nextTick(() => loadingFadeOut());
