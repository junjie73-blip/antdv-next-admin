<script setup lang="ts">
import { computed } from 'vue';

import { TabsBar } from '@antdv/tabs-ui';
import { useAppStore } from '@antdv/stores';

import { useTabs } from '../../hooks/use-tabs';

defineOptions({ name: 'LayoutTabs' });

/**
 * 这里只是一层适配器：偏好（`appStore`）与标签数据（`useTabs` 背后的 store）
 * 都在应用侧，渲染与「能不能执行」的判断全部交给 `@antdv/tabs-ui`。
 */
const props = withDefaults(defineProps<{ showIcon?: boolean }>(), {
  showIcon: undefined,
});

const appStore = useAppStore();
const tabsApi = useTabs();
const { activeKey, tabs, tabsStore } = tabsApi;

const tabsProps = computed(() => ({
  activeKey: activeKey.value,
  contextMenu: appStore.tabContextMenu,
  draggable: appStore.tabDragSort !== false,
  maximizedKey: tabsStore.maximizedKey,
  // 显式传入的 showIcon 优先，否则读偏好（关闭图标时标签不留图标槽）
  showIcon: props.showIcon ?? appStore.tabShowIcon !== false,
  tabStyle: appStore.tabStyle,
  tabs: tabs.value,
  themeStyle: appStore.themeStyle,
}));

function handleAction(key: string, tabKey?: string) {
  const target = tabKey ?? activeKey.value;
  switch (key) {
    case 'affix': {
      tabsApi.toggleAffix(target);
      break;
    }
    case 'close': {
      tabsApi.close(target);
      break;
    }
    case 'closeAll': {
      tabsApi.closeAll();
      break;
    }
    case 'closeLeft': {
      tabsApi.closeLeft(target);
      break;
    }
    case 'closeOther': {
      tabsApi.closeOthers(target);
      break;
    }
    case 'closeRight': {
      tabsApi.closeRight(target);
      break;
    }
    case 'maximize': {
      tabsApi.toggleMaximize(target);
      break;
    }
    case 'openInNewWindow': {
      tabsApi.openInNewWindow(target);
      break;
    }
    // reload 与 refresh 是同一动作的两种历史命名，语义都走 /redirect 重建
    case 'refresh':
    case 'reload': {
      tabsApi.refresh(target);
      break;
    }
  }
}
</script>

<template>
  <TabsBar
    v-if="appStore.showTabs"
    v-bind="tabsProps"
    @activate="tabsApi.activate"
    @action="handleAction"
    @close="tabsApi.close"
    @reorder="tabsApi.reorder"
  />
</template>
