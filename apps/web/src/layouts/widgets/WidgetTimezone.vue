<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared';
import { nowTz } from '@antdv/shared/utils/dayjs';
import { Icon } from '@iconify/vue';
import { useAppStore } from '~/stores/modules/app';

import { TIMEZONE_OPTIONS } from '../components/SettingDrawer/constants.js';
import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetTimezone' });

/** 时区选项的形状跟着常量表走，不再依赖菜单组件的内部类型 */
type TimezoneOption = (typeof TIMEZONE_OPTIONS)[number];

const { t } = useI18n({ useScope: 'global' });
const appStore = useAppStore();

/* ============================================================
 * 实时时钟
 * ============================================================ */
const now = ref(nowTz());
let timer: null | ReturnType<typeof setInterval> = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = nowTz();
  }, 30_000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

/* ============================================================
 * 打开/关闭
 * ============================================================ */
const open = ref(false);

function handleSelect(value: string) {
  if (value === appStore.timezone) {
    open.value = false;
    return;
  }
  appStore.updateSetting({ timezone: value });
  now.value = nowTz();
  open.value = false;
}

const items = computed<TimezoneOption[]>(() => TIMEZONE_OPTIONS);

/** 当前时区那一项高亮：菜单里没有 selectedKeys，自己给同一套蓝底字面量 class */
function itemClass(item: TimezoneOption) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-left',
    item.value === appStore.timezone
      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
      : 'text-slate-600 dark:text-slate-300',
  );
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <WidgetButton :label="t('header.timezone')" data-testid="timezone-widget">
        <Icon icon="carbon:time" class="text-base" />
      </WidgetButton>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="min-w-[180px]" side="bottom">
      <DropdownMenuItem
        v-for="item in items"
        :key="item.value"
        :aria-current="item.value === appStore.timezone ? 'true' : undefined"
        :class="itemClass(item)"
        :data-testid="`timezone-option-${item.value}`"
        @click="handleSelect(item.value)"
      >
        <span class="truncate text-[12px] leading-tight">{{ item.value }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
