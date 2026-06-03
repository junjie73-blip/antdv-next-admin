import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { localStorageCacheStorage } from '@/utils/cache'

const LOCALE_KEY = 'locale'

export type LocaleType = 'zh-CN' | 'en-US'

export const localeLabels: Record<LocaleType, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
}

export function useLocale() {
  const { locale, t, availableLocales } = useI18n({ useScope: 'global' })

  const currentLocale = computed<LocaleType>(() => locale.value as LocaleType)

  function setLocale(lang: LocaleType) {
    locale.value = lang
    localStorageCacheStorage.setItem(LOCALE_KEY, lang)
    // 切换 HTML lang 属性
    document.documentElement.lang = lang
  }

  return {
    locale: currentLocale,
    t,
    setLocale,
    availableLocales,
  }
}
