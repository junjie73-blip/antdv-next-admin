<script setup lang="ts">
import { autoPrefixTransformer, px2remTransformer } from '@antdv-next/cssinjs'
import { HappyProvider } from '@antdv-next/happy-work-theme'
import { ConfigProvider, StyleProvider } from 'antdv-next'
import dayjs from 'dayjs'
import { computed, onMounted, shallowRef, watch } from 'vue'
import { getThemeConfig } from '@/settings'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'

const appStore = useAppStore()
const userStore = useUserStore()

// 应用启动时解密 Token
onMounted(() => {
  userStore.initToken()
})

const antdLocale = shallowRef<any>()

const getPopupContainer = (triggerNode?: HTMLElement | undefined): HTMLElement => triggerNode?.parentElement || document.body

const themeConfig = computed(() => getThemeConfig(
  appStore.themeStyle,
  appStore.themeMode === 'dark',
  appStore.borderRadius,
  appStore.primaryColor,
))

const htmlClass = computed(() => {
  const classes: string[] = []
  if (appStore.themeMode === 'dark')
    classes.push('dark')
  if (appStore.colorWeak)
    classes.push('color-weak')
  if (appStore.grayMode)
    classes.push('gray-mode')
  return classes.join(' ')
})

watch(
  () => appStore.locale,
  async (locale) => {
    const dayjsLocaleMap: Record<string, string> = {
      'zh-CN': 'zh-cn',
      'zh-TW': 'zh-tw',
      'en-US': 'en',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
    }

    dayjs.locale(dayjsLocaleMap[locale] || 'en')

    const localeModules: Record<string, () => Promise<{ default: any }>> = {
      'zh-CN': () => import('antdv-next/locale/zh_CN'),
      'zh-TW': () => import('antdv-next/locale/zh_TW'),
      'en-US': () => import('antdv-next/locale/en_US'),
      'ja-JP': () => import('antdv-next/locale/ja_JP'),
      'ko-KR': () => import('antdv-next/locale/ko_KR'),
    }

    const loader = localeModules[locale] || localeModules['zh-CN']
    if (loader) {
      const module = await loader()
      antdLocale.value = module.default
    }
  },
  { immediate: true },
)

watchEffect(() => {
  const html = document.documentElement
  html.className = htmlClass.value
})

watch(
  () => appStore.primaryColor,
  (color) => {
    document.documentElement.style.setProperty('--ant-color-primary', color)
  },
  { immediate: true },
)
</script>

<template>
  <HappyProvider
    v-slot="{ wave }"
    :enabled="appStore.enableWaterRipple"
  >
    <StyleProvider>
      <ConfigProvider
        :theme="themeConfig"
        :wave="wave"
        :locale="antdLocale"
        :transformers="[autoPrefixTransformer,
                        px2remTransformer]"
        :get-popup-container="getPopupContainer"
        :component-size="appStore.componentSize"
      >
        <a-app
          :notification="{
            placement: appStore.notificationPosition,
          }"
        >
          <router-view />
        </a-app>
      </ConfigProvider>
    </StyleProvider>
  </HappyProvider>
</template>
