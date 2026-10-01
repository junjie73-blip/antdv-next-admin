<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Segmented } from 'antdv-next'
import { ref } from 'vue'

import AppearancePanel from './components/AppearancePanel.vue'
import CommonPanel from './components/CommonPanel.vue'
import LayoutPanel from './components/LayoutPanel.vue'
import SettingFooter from './components/SettingFooter.vue'
import {
  drawerBodyClassName,
  drawerContentClassName,
  drawerHeaderClassName,
  SECTION_OPTIONS,
  sectionStyles,
  type SettingSection,
} from './constants'

defineOptions({ name: 'SettingDrawer' })

const visible = defineModel<boolean>('visible', { default: false })

const activeSection = ref<SettingSection>('appearance')

function handleClose() {
  activeSection.value = 'appearance'
  visible.value = false
}
</script>

<template>
  <a-drawer
    v-model:open="visible"
    placement="right"
    :width="380"
    :closable="false"
    :styles="{ body: { padding: 0 } }"
    root-class-name="setting-drawer"
  >
    <template #title>
      <div :class="drawerHeaderClassName">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15"
          >
            <Icon icon="carbon:settings" class="text-ant-primary text-lg" />
          </div>
          <div>
            <div class="text-[15px] font-semibold text-slate-800 dark:text-slate-100">主题配置</div>
            <div class="mt-0.5 text-[11px] text-slate-400">定制你的工作空间</div>
          </div>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          @click="handleClose"
        >
          <Icon icon="carbon:close" class="text-lg" />
        </button>
      </div>
    </template>
    <div :class="drawerBodyClassName">
      <div :class="drawerContentClassName">
        <div class="shrink-0 p-4">
          <Segmented v-model:value="activeSection" :options="SECTION_OPTIONS" :styles="sectionStyles" block />
        </div>

        <!-- 面板（滚动） -->
        <Scrollbar class="h-full" height="720">
          <div class="px-5 pt-1">
            <AppearancePanel v-if="activeSection === 'appearance'" />
            <LayoutPanel v-else-if="activeSection === 'layout'" />
            <CommonPanel v-else-if="activeSection === 'common'" />
          </div>
        </Scrollbar>
      </div>
    </div>
    <template #footer>
      <SettingFooter @close="handleClose" />
    </template>
  </a-drawer>
</template>

<style scoped>
/* 毛玻璃 */
:global(.setting-drawer .ant-drawer-content) {
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

:global(.dark .setting-drawer .ant-drawer-content) {
  background: rgba(2, 6, 23, 0.96);
}

/* Segmented 选中态高亮 */
:global(.ant-segmented-item-selected) {
  color: var(--ant-color-primary, #1677ff) !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :global(.setting-drawer .ant-drawer-content) {
    background: #fff;
  }
  :global(.dark .setting-drawer .ant-drawer-content) {
    background: #020617;
  }
}
</style>
