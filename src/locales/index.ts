import { createI18n } from 'vue-i18n'
import { localStorageCacheStorage } from '@/utils/cache'
import enUS from './lang/en-US'
import zhCN from './lang/zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: localStorageCacheStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export default i18n
