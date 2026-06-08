import FcDesigner from '@form-create/antd-designer'
import formCreate from '@form-create/antdv-next'
import install from '@form-create/antdv-next/auto-import'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar'
import App from './App.vue'
import { escapeDirective, safeHtmlDirective } from './directives'
import { vLogClick } from './directives/log'
import i18n from './locales'
import { setupRouter } from './router'
import { initSecuritySystem } from './utils/securityInit'
import 'virtual:svg-icons-register'
import './assets/styles/global.css'
import 'antdv-next/dist/antd.css'
import 'vue3-perfect-scrollbar/style.css'

// 按需导入 form-create 组件
formCreate.use(install)

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(i18n)
app.use(formCreate)
app.use(FcDesigner)
setupRouter(app)
app.use(PerfectScrollbarPlugin)

// ==================== 初始化安全防护系统 ====================
// 在应用启动时立即初始化 CSRF Token 和安全配置
initSecuritySystem({
  csrfHeaderName: 'X-CSRF-Token',
  enableDoubleSubmit: true,
  autoRotateToken: true,
})

// ==================== 全局注册安全防护指令 ====================
// v-safe-html: 安全渲染 HTML（自动过滤 XSS 攻击代码）
app.directive('safe-html', safeHtmlDirective)

// v-escape: 自动转义文本内容（防止注入攻击）
// 用法：v-escape="value" | v-escape:url="url" | v-escape:js="code"
app.directive('escape', escapeDirective)

// v-log-click: 自动记录按钮点击操作日志
// 用法：v-log-click="'保存'" | v-log-click:delete="'删除记录'"
app.directive('log-click', vLogClick)

app.mount('#app')

// 注册 Service Worker（PWA 支持）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 开发环境或不支持时静默失败
    })
  })
}
