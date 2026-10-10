<script setup lang="ts">
import type { SettingSection } from './constants';

import { ref } from 'vue';

import { Icon } from '@iconify/vue';
import { Segmented } from 'antdv-next';
import { projectConfig } from '~/config/project';

import AppearancePanel from './components/AppearancePanel.vue';
import CommonPanel from './components/CommonPanel.vue';
import LayoutPanel from './components/LayoutPanel.vue';
import SettingFooter from './components/SettingFooter.vue';
import {
  drawerBodyClassName,
  drawerContentClassName,
  drawerHeaderClassName,
  SECTION_OPTIONS,
  sectionStyles,
} from './constants';

defineOptions({ name: 'SettingDrawer' });

const visible = defineModel<boolean>('visible', { default: false });

/**
 * 模板里那行 `root-class="setting-drawer"` 用的是 antdv-next 的命名（React 版 antd 叫
 * `rootClassName`）。写错属性名不会报错，只会当成未知属性丢掉：抽屉根节点上永远等不到
 * `.setting-drawer`，所有拿它做作用域的选择器（样式覆盖、e2e 定位）静默落空。
 */
const activeSection = ref<SettingSection>('appearance');

function handleClose() {
  activeSection.value = 'appearance';
  visible.value = false;
}
</script>

<template>
  <a-drawer
    v-model:open="visible"
    placement="right"
    :size="380"
    :closable="false"
    :styles="{ body: { padding: 0, overflow: 'hidden' } }"
    root-class="setting-drawer"
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
            <div
              class="text-[15px] font-semibold text-slate-800 dark:text-slate-100"
            >
              主题配置
            </div>
            <div class="mt-0.5 text-[11px] text-slate-400">
              定制你的工作空间
            </div>
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
          <Segmented
            v-model:value="activeSection"
            :options="SECTION_OPTIONS"
            :styles="sectionStyles"
            block
          />
        </div>

        <!--
          面板（滚动）：容器高度由上一层的 flex 分配，所以这里给 `min-h-0 flex-1`。
          `rootClass` 传了就不会再套组件默认的 `h-full`——那正是"底部看不全"的元凶：
          h-full = 100% 容器高，加上面切换条的高度就超出了容器。
          另外组件没有 `height` 这个 prop，之前的 `height="720"` 只是个被忽略的属性，
          想限制高度得用 `maxHeight`（且它会走 useResponsiveMaxHeight 的下限 712px，
          比抽屉本身还高，等于没有）。这里让它自适应，交给 flex 计算。
        -->
        <Scrollbar
          root-class="min-h-0 flex-1"
          :native="projectConfig.scrollbar?.native ?? false"
        >
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
