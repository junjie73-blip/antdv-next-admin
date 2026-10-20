import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import dayjs from '@antdv/shared/utils/dayjs';
import i18n from '~/locales';
import { useAppStore } from '@antdv/stores';

import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';

export type LocaleType = 'en-US' | 'zh-CN';

/** 语言名一律用本语言自称（English 不译成「英语」），这是界面文案的通行惯例 */
export const localeLabels: Record<LocaleType, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
};

/** dayjs 的 locale 名是小写短码（`zh-cn`），与偏好里的 BCP 47 写法不同源 */
const DAYJS_LOCALE_MAP: Record<LocaleType, string> = {
  'en-US': 'en',
  'zh-CN': 'zh-cn',
};

/**
 * 把 locale 展开成界面的三件事：i18n 文案、`<html lang>`、dayjs 格式化。
 *
 * 只应由 `useLocaleSync` 调用；任何组件都不该再自己写 `i18n.global.locale`，
 * 两处各写一份就会漂移 —— 表现是「切了语言，菜单变英文、分页器还是中文」。
 */
function applyLocale(locale: LocaleType): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
  dayjs.locale(DAYJS_LOCALE_MAP[locale]);
}

/**
 * locale 效应的唯一出口：偏好里的 `locale` 一变，就把 i18n、`<html lang>` 与 dayjs 一起对齐。
 *
 * 以前这里还多返回一个 antd 的 locale 对象给 `ConfigProvider :locale`（内置文案
 * OK/Cancel、分页器「条/页」那种）。antd 依赖移除后，组件的内置文案由
 * `@antdv/common-ui` 的 ConfigProvider 按 `'en-US' | 'zh-CN'` 自己展开（`textsByLocale`），
 * 日期排版走 reka-ui 的 locale 注入，两条链路都只需要那个字符串，所以这里不再有返回值。
 */
export function useLocaleSync(): void {
  const appStore = useAppStore();

  watch(
    () => appStore.locale as LocaleType,
    (locale) => applyLocale(locale),
    { immediate: true },
  );
}

export function useLocale() {
  const appStore = useAppStore();
  const { t, availableLocales } = useI18n({ useScope: 'global' });

  const locale = computed(() => appStore.locale as LocaleType);

  /** 写入只有一条路：改偏好，效应由 `useLocaleSync` 统一展开 */
  function setLocale(next: LocaleType) {
    appStore.updateSetting({ locale: next });
  }

  return {
    availableLocales,
    locale,
    setLocale,
    t,
  };
}
