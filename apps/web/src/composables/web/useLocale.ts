import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import dayjs from '@antdv/shared/utils/dayjs';
import i18n from '~/locales';
import { loadLocale } from '~/settings';
import { useAppStore } from '~/stores/modules/app';

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
 * 把 locale 展开成界面的四件事：i18n 文案、`<html lang>`、dayjs 格式化、antd 内置文案。
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
 * locale 效应的唯一出口，返回 antd 的 locale 对象给 `ConfigProvider :locale`。
 *
 * 语言包按需动态 import，所以是异步的；这一步以前是注释掉的，`antdLocale` 恒为
 * undefined，ConfigProvider 退回英文兜底 —— 整站中文的界面里 antd 自带文案
 * （Popconfirm 的 OK/Cancel、表格空状态、分页器）全是英文，属于全站性缺陷。
 */
export function useLocaleSync() {
  const appStore = useAppStore();
  // `loadLocale` 返回 unknown（antd 的 `Locale` 类型没有从 antdv-next 包根导出），
  // 这个值只用于透传给 ConfigProvider 的 `:locale`。
  const antdLocale = shallowRef<any>();

  watch(
    () => appStore.locale as LocaleType,
    async (locale) => {
      applyLocale(locale);
      antdLocale.value = await loadLocale(locale);
    },
    { immediate: true },
  );

  return antdLocale;
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
