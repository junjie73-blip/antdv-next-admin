<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { autoPrefixTransformer, px2remTransformer } from '@antdv-next/cssinjs';
import { HappyProvider } from '@antdv-next/happy-work-theme';
import dayjs from '@antdv/shared/dayjs';
import { ConfigProvider, StyleProvider } from 'antdv-next';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getThemeConfig, loadLocale } from '~/settings';
import { useAppStore } from '~/stores/modules/app';

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);
const mode = import.meta.env.MODE;
const appStore = useAppStore();

dayjs.locale('zh-CN');

const antdLocale = shallowRef<any>();

/**
 * 弹层挂载点。
 *
 * 默认挂在触点的父节点上，是为了让下拉/气泡在**内层滚动容器**里跟着内容一起滚
 * （挂 body 的话滚动时会被留在原地）。但这一条在表格固定列上是反效果：
 * 固定列的 `<td class="ant-table-cell-fix-end">` 是 `position: sticky` 且自带 z-index，
 * sticky 一律形成层叠上下文 —— 弹层挂进去以后，它的 `z-index: 1060` 只在这个上下文里比大小，
 * 于是被隔壁那一格的 sticky 阴影（`...-fix-end-shadow-show`）整块盖住。
 * 表现："删除"的二次确认弹出来了，但「确定」点不下去，鼠标实际点到的是表格单元格。
 * 落点在固定列里时退回 body：弹层脱离这个上下文，位置照样算得对，代价是
 * "开着弹层滚表格"这种罕见操作下面板不跟着走，比"按钮点不动"轻得多。
 */
const getPopupContainer = (triggerNode?: HTMLElement): HTMLElement => {
  if (
    triggerNode?.closest(
      '.ant-table-cell-fix, .ant-table-cell-fix-start, .ant-table-cell-fix-end',
    )
  ) {
    return document.body;
  }
  return triggerNode?.parentElement || document.body;
};

const themeConfig = computed(() =>
  getThemeConfig(appStore.appSetting, appStore.isSystemDark),
);

const DAYJS_LOCALE_MAP: Record<string, string> = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'en-US': 'en',
};

watch(
  () => appStore.locale,
  async (locale) => {
    // 1) 切 dayjs（日期格式化跟着语言走）
    dayjs.locale(DAYJS_LOCALE_MAP[locale] || 'zh-cn');
    // 2) 切 antd locale：语言包按需动态 import，失败时由包内部回落默认语言
    //    这一行以前是注释掉的，于是 `antdLocale` 恒为 undefined，ConfigProvider 用英文兜底：
    //    整站中文的界面里，凡是 antd 自带文案的地方都是英文 ——
    //    Popconfirm 的「Cancel / OK」、Upload 图片墙的 title="Preview file / Download file / Delete file"、
    //    Table 的空状态与"暂无数据"、Pagination 的页码文案。切换到中文才露出来，属于全站性缺陷。
    antdLocale.value = await loadLocale(locale);
  },
  { immediate: true },
);
</script>

<template>
  <HappyProvider v-slot="{ wave }" :enabled="appStore.enableWaterRipple">
    <StyleProvider>
      <ConfigProvider
        :theme="themeConfig"
        :wave="wave"
        :locale="antdLocale"
        :transformers="[autoPrefixTransformer, px2remTransformer]"
        :get-popup-container="getPopupContainer"
        :component-size="appStore.componentSize"
        virtual
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
