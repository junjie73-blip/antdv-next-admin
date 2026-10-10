<script setup lang="ts">
import { computed, provide, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { BasicDrawer, useDrawer } from '~/components/business/Drawer';
import AccountCenter from '~/views/account/center/index.vue';
import AccountSettings from '~/views/account/settings/index.vue';

defineOptions({ name: 'AccountDrawer' });

type AccountTab = 'center' | 'settings';

/**
 * 个人中心抽屉。
 *
 * 「个人中心」已经从导航菜单里撤下（后端菜单标了 `hidden`），头像下拉是它唯一的入口，
 * 所以抽屉要能同时承担原来的两个页面：个人主页与账户设置。
 * 两个页面本体不改动 —— 主页里的「前往修改」按钮通过 `switchAccountTab` 反向切 tab，
 * 抽屉顶部的 tab 条则负责来回切换，避免出现"进了账户设置就出不来"的死胡同。
 */
const [registerDrawer, drawerMethods] = useDrawer();
const activeTab = ref<AccountTab>('center');

const TABS: Array<{ icon: string; key: AccountTab; label: string }> = [
  { key: 'center', label: '个人主页', icon: 'carbon:user-profile' },
  { key: 'settings', label: '账户设置', icon: 'carbon:settings' },
];

const currentComponent = computed(() =>
  activeTab.value === 'settings' ? AccountSettings : AccountCenter,
);

function switchTab(tab: AccountTab) {
  activeTab.value = tab;
}

provide('switchAccountTab', switchTab);

function open(tab: AccountTab = 'center') {
  activeTab.value = tab;
  drawerMethods.openDrawer();
}

function close() {
  drawerMethods.closeDrawer();
}

/** tab 条吸顶：抽屉内容整块滚动，切页签时不必先滚回顶部 */
const tabBarClassName = cn(
  'sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-1 rounded-xl bg-white/90 px-1 py-1 backdrop-blur',
  'border border-gray-200/80 dark:border-gray-700',
);

const tabItemClassName = (tab: AccountTab) =>
  cn(
    'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
    tab === activeTab.value
      ? 'bg-ant-primary font-medium text-white'
      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
  );

defineExpose({ open, close });
</script>

<template>
  <BasicDrawer
    title="个人中心"
    :size="720"
    :show-footer="false"
    :mask-closable="true"
    :destroy-on-hidden="false"
    @register="registerDrawer"
  >
    <div data-account-drawer class="min-h-0">
      <div role="tablist" :class="tabBarClassName" aria-label="个人中心页签">
        <button
          v-for="item in TABS"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="item.key === activeTab"
          :class="tabItemClassName(item.key)"
          @click="switchTab(item.key)"
        >
          <Icon :icon="item.icon" class="text-base" />
          {{ item.label }}
        </button>
      </div>

      <component :is="currentComponent" />
    </div>
  </BasicDrawer>
</template>
