<script setup lang="ts">
import type { SettingSection } from './constants';

import { computed, ref } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
import { Scrollbar, Segmented } from '@antdv/common-ui';
import { BasicDrawer } from '@antdv/popup-ui';

import { useWindowSize } from '@vueuse/core';

import { DrawerTitle } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

import { layoutHost } from '../../host';
import AppearancePanel from './components/appearance-panel.vue';
import CommonPanel from './components/common-panel.vue';
import LayoutPanel from './components/layout-panel.vue';
import SettingFooter from './components/setting-footer.vue';
import {
  drawerContentClassName,
  drawerHeaderClassName,
  SECTION_OPTIONS,
} from './constants';

defineOptions({ name: 'SettingDrawer' });

const { t } = useLayoutI18n();

const visible = defineModel<boolean>('visible', { default: false });

/**
 * 抽屉宽度：桌面固定 380px，窄屏跟着视口收。
 *
 * `BasicDrawer` 的 `size` 是数值（右侧档要横向占位），写死 380 在 360px 的手机上
 * 会把整块内容顶出视口 —— 左边留 24px 让它贴边，再兜一个 280px 的下限，
 * 保证极窄视口下也不会缩到面板没法用。
 */
const { width: viewportWidth } = useWindowSize();
const drawerSize = computed(() =>
  Math.max(280, Math.min(380, viewportWidth.value - 24)),
);

/** `setting-drawer` 是样式覆盖和 e2e 定位的作用域钩子，改名会同时打断两边 */
const activeSection = ref<SettingSection>('appearance');

function handleClose() {
  activeSection.value = 'appearance';
  visible.value = false;
}
</script>

<template>
  <BasicDrawer
    v-model:open="visible"
    placement="right"
    :size="drawerSize"
    :closable="false"
    :body-scroll="false"
    :use-wrapper="false"
    wrap-class-name="setting-drawer"
  >
    <template #header>
      <div :class="drawerHeaderClassName">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15"
          >
            <Icon icon="carbon:settings" class="text-primary text-lg" />
          </div>
          <div>
            <DrawerTitle as-child>
              <div
                class="text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              >
                {{ t('preferences.title') }}
              </div>
            </DrawerTitle>
            <div class="mt-0.5 text-[11px] text-slate-400">
              {{ t('preferences.subtitle') }}
            </div>
          </div>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          :aria-label="t('common.close')"
          @click="handleClose"
        >
          <Icon icon="carbon:close" class="text-lg" />
        </button>
      </div>
    </template>

    <!--
      切换条固定、面板单独滚动：`:body-scroll="false"` 关掉了抽屉自带的 ScrollArea，
      滚动只由里面这层 Scrollbar 负责，所以内容列要 h-full 撑满抽屉正文。
    -->
    <div :class="drawerContentClassName">
      <div class="shrink-0 p-4">
        <Segmented
          v-model:value="activeSection"
          :options="SECTION_OPTIONS"
          block
        />
      </div>

      <Scrollbar
        root-class="min-h-0 flex-1"
        :native="layoutHost.nativeScrollbar"
      >
        <div class="px-5 pb-5 pt-1">
          <AppearancePanel v-if="activeSection === 'appearance'" />
          <LayoutPanel v-else-if="activeSection === 'layout'" />
          <CommonPanel v-else-if="activeSection === 'common'" />
        </div>
      </Scrollbar>
    </div>

    <template #footer>
      <div class="border-border border-t px-5 py-4">
        <SettingFooter @close="handleClose" />
      </div>
    </template>
  </BasicDrawer>
</template>
