<script setup lang="ts">
import type { TabActionContext, TabActionItem } from './constants';

import { computed, h } from 'vue';

import { SettingOutlined } from '@antdv-next/icons';
import { Icon } from '@iconify/vue';
import { Dropdown } from 'antdv-next';

import { buildTabActions } from './constants';

defineOptions({ name: 'TabActions' });

const props = defineProps<{
  context: TabActionContext;
}>();

const emit = defineEmits<{
  action: [key: string];
}>();

const items = computed<TabActionItem[]>(() => buildTabActions(props.context));

/**
 * antdv-next 的 Dropdown menu.items 需要渲染函数形式的 icon，
 * 这里把 Iconify 组件包成 h()，避免在模板里写 JSX。
 */
const menuItems = computed(() =>
  items.value.map((item, index) => {
    // 分隔线要渲染成 antd 的 divider 项，而不是一个空的禁用条目
    if (item.divider) return { key: `divider-${index}`, type: 'divider' as const };

    // 闭包里读 item.icon 会丢掉三元判断带来的窄化，先取成局部常量
    const icon = item.icon;
    return {
      disabled: item.disabled,
      icon: icon ? () => h(Icon, { class: 'text-sm', icon }) : undefined,
      key: item.key,
      label: item.label,
    };
  }),
);

function onClick({ key }: { key: number | string }) {
  emit('action', String(key));
}
</script>

<template>
  <Dropdown
    :menu="{ items: menuItems, onClick }"
    placement="bottomRight"
    :trigger="['click']"
  >
    <a-tooltip title="标签页操作">
      <!--
        只有图标的按钮必须有可访问名字：读屏用户走到这里要知道按的是"标签页操作"，
        e2e 也不必再用 class 去猜它（tooltip 只在悬停时出现，不构成 accessible name）。
      -->
      <a-button
        type="text"
        size="small"
        class="shrink-0 self-center"
        aria-label="标签页操作"
      >
        <template #icon>
          <SettingOutlined />
        </template>
      </a-button>
    </a-tooltip>
  </Dropdown>
</template>
