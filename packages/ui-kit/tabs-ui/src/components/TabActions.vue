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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
  <DropdownMenu>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <!--
              只有图标的按钮必须有可访问名字：读屏用户走到这里要知道按的是"标签页操作"，
              e2e 也不必再用 class 去猜它（tooltip 只在悬停时出现，不构成 accessible name）。
            -->
            <Button
              :aria-label="tabsRuntime.t('shell.tabActions')"
              class="tab-actions-trigger shrink-0 self-center"
              size="icon-sm"
              variant="ghost"
            >
              <Icon icon="ant-design:setting-outlined" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {{ tabsRuntime.t('shell.tabActions') }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

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
