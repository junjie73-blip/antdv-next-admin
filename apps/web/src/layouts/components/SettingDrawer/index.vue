<script setup lang="ts">
import type { SettingSection } from './constants';

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { Scrollbar, Segmented } from '@antdv/common-ui';
import { BasicDrawer } from '@antdv/popup-ui';

import { DrawerTitle } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { projectConfig } from '~/config/project';

import AppearancePanel from './components/AppearancePanel.vue';
import CommonPanel from './components/CommonPanel.vue';
import LayoutPanel from './components/LayoutPanel.vue';
import SettingFooter from './components/SettingFooter.vue';
import {
  drawerContentClassName,
  drawerHeaderClassName,
  SECTION_OPTIONS,
} from './constants';

defineOptions({ name: 'SettingDrawer' });

const { t } = useI18n({ useScope: 'global' });

const visible = defineModel<boolean>('visible', { default: false });

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
    :size="380"
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
        :native="projectConfig.scrollbar?.native ?? false"
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
