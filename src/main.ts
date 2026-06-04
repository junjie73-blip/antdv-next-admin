import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar'
import App from './App.vue'
import i18n from './locales'
import { setupRouter } from './router'
import 'virtual:svg-icons-register'
import './styles/global.css'
import 'antdv-next/dist/antd.css'
import 'vue3-perfect-scrollbar/style.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(i18n)
setupRouter(app)
app.use(PerfectScrollbarPlugin)

app.mount('#app')

// 注册 Service Worker（PWA 支持）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 开发环境或不支持时静默失败
    })
  })
}
