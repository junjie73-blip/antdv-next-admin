<script setup lang="ts">
import type { TabActionContext, TabActionItem } from '../types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';

import { tabsRuntime } from '../config';
import { buildTabActions } from '../constants';

defineOptions({ name: 'TabActions' });

const props = defineProps<{
  context: TabActionContext;
}>();

const emit = defineEmits<{
  action: [key: string];
}>();

const items = computed<TabActionItem[]>(() => buildTabActions(props.context));
</script>

<template>
  <!--
    这里刻意不套 reka 的 Tooltip。TooltipRoot 和 MenuRoot 各自提供一个 PopperRoot，
    而 inject 只认组件树上最近的那一份：Trigger 一旦落在 Tooltip 的子树里，锚点就注册到
    tooltip 的 PopperRoot 上，菜单自己的那一份永远是空的，浮层按零尺寸锚点算坐标
    （实测 translate(0, -614px)，弹层跑到视口外）。悬停提示改用原生 `title`。
  -->
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <!--
        只有图标的按钮必须有可访问名字：读屏用户走到这里要知道按的是"标签页操作"，
        e2e 也不必再用 class 去猜它。
      -->
      <Button
        :aria-label="tabsRuntime.t('shell.tabActions')"
        :title="tabsRuntime.t('shell.tabActions')"
        class="tab-actions-trigger shrink-0 self-center"
        size="icon-sm"
        variant="ghost"
      >
        <Icon icon="ant-design:setting-outlined" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end">
      <template v-for="item in items" :key="`${item.key}-${item.label}`">
        <DropdownMenuSeparator v-if="item.divider" />
        <DropdownMenuItem
          v-else
          :disabled="item.disabled"
          @select="emit('action', item.key)"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="text-sm" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
