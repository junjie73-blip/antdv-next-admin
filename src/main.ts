
import FcDesigner from "@form-create/antd-designer";
import formCreate from "@form-create/antdv-next";
import install from "@form-create/antdv-next/auto-import";
import * as Sentry from "@sentry/vue";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { PerfectScrollbarPlugin } from "vue3-perfect-scrollbar";

import App from "./App.vue";
import { escapeDirective, safeHtmlDirective } from "./directives";
import i18n from "./locales";
import { setupRouter } from "./router";
import { initSecuritySystem } from "./utils/securityInit";

import "virtual:svg-icons-register";
import "./assets/styles/global.css";
import "antdv-next/dist/antd.css";
import "vue3-perfect-scrollbar/style.css";
// 按需导入 form-create 组件
formCreate.use(install);

const app = createApp(App);
const pinia = createPinia();

if (import.meta.env.PROD) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/vue/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: []
    },
    integrations: [
      Sentry.browserTracingIntegration({ router: setupRouter(app) }),
      Sentry.replayIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/121.4.127.82\.io\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });
} else {
  setupRouter(app);
}

app.use(pinia);
app.use(i18n);
app.use(formCreate);
app.use(FcDesigner);

app.use(PerfectScrollbarPlugin);

// ==================== 初始化安全防护系统 ====================
// 在应用启动时立即初始化 CSRF Token 和安全配置
initSecuritySystem({
  csrfHeaderName: "X-CSRF-Token",
  enableDoubleSubmit: true,
  autoRotateToken: true,
});

// ==================== 全局注册安全防护指令 ====================
// v-safe-html: 安全渲染 HTML（自动过滤 XSS 攻击代码）
app.directive("safe-html", safeHtmlDirective);

// v-escape: 自动转义文本内容（防止注入攻击）
// 用法：v-escape="value" | v-escape:url="url" | v-escape:js="code"
app.directive("escape", escapeDirective);
app.mount("#app");
