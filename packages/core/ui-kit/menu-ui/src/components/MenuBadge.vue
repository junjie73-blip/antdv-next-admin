<script setup lang="ts">
import type { MenuBadge as MenuBadgeConfig } from '@antdv/types';

defineOptions({ name: 'MenuBadge' });

const props = withDefaults(defineProps<{ badge?: MenuBadgeConfig }>(), {
  badge: undefined,
});

/**
 * 徽标自绘：迁移前由 `@antdv/utils` 借 antd Badge 渲染，
 * 包一拆就不能再把 antd 拖进 menu-ui。尺寸照抄侧栏里已经调好的那组
 * （11px 字号、16px 高、点标 6px、默认溢出 99）。
 */
const STATUS_DOT: Record<string, string> = {
  default: 'bg-gray-400',
  error: 'bg-red-500',
  processing: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
};

function dotClass(status?: string): string {
  return STATUS_DOT[status ?? 'default'] ?? STATUS_DOT.default!;
}

/** 只有数字才做溢出折叠，文案徽标（NEW / Beta）原样显示 */
function displayText(badge: MenuBadgeConfig): string {
  const { overflowCount = 99, text } = badge;
  if (badge.dot || text === undefined || text === null || text === '') {
    return '';
  }
  const count = Number(text);
  return Number.isFinite(count) && count > overflowCount
    ? `${overflowCount}+`
    : String(text);
}
</script>

<template>
  <span
    v-if="badge?.dot"
    class="inline-block h-1.5 w-1.5 shrink-0 rounded-full" :class="[dotClass(badge.status)]"
    data-menu-badge="dot"
  ></span>
  <span
    v-else-if="badge && displayText(badge)"
    class="inline-block min-w-4 shrink-0 rounded-full px-1 text-center text-[11px] leading-4" :class="[
      badge.status
        ? `${dotClass(badge.status)} text-white`
        : 'bg-red-500 text-white shadow-[0_0_0_1px_#fff]',
    ]"
    data-menu-badge="count"
  >
    {{ displayText(badge) }}
  </span>
</template>
