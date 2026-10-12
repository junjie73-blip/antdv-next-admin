<script setup lang="ts">
import { onMounted } from 'vue';

import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'ErrorProneContent' });

const props = withDefaults(
  defineProps<{
    /** 是否在本次挂载里抛错（模拟接口返回了不符合契约的数据） */
    fail?: boolean;
  }>(),
  {
    fail: false,
  },
);

/** 正常分支：真实业务里这里是接口返回后渲染好的内容 */
const panelRows = [
  { key: 'env', label: '运行环境', value: 'production' },
  { key: 'region', label: '部署区域', value: 'cn-hangzhou' },
  { key: 'timeout', label: '超时阈值', value: '3000 ms' },
];

/**
 * 抛错点放在挂载后的数据校验里（真实项目就是"接口回来 → 解析 → 字段不符合契约"）。
 *
 * 刻意不放在 `<script setup>` 顶层：setup 一旦抛出，Vue 已经吞掉异常并继续把这个
 * 半成品实例挂上去，紧接着的 render 会因为 setupState 是空的再抛一次
 * （`$setup.xxx is not a function`），外层 ErrorBoundary 最终显示的是那第二条莫名其妙的错，
 * 而不是业务真正想报的那条。生命周期钩子 / 渲染 / watcher 里的异常同样会经
 * `onErrorCaptured` 冒泡到父级，效果一样，但只有一条错误。
 */
onMounted(() => {
  if (props.fail) {
    throw new Error(
      '同步远端配置失败：字段 timeout 期望 number，实际收到 "30s"',
    );
  }
});

const rowClassName = cn(
  'flex items-center justify-between',
  'border-b border-dashed border-gray-200 py-2',
  'last:border-b-0 dark:border-gray-700',
);

const labelClassName = cn('text-sm text-gray-500 dark:text-gray-400');
const valueClassName = cn('font-mono text-sm text-gray-900 dark:text-gray-100');
</script>

<template>
  <div
    :class="cn('rounded-lg border border-gray-200 p-4 dark:border-gray-700')"
  >
    <p :class="cn('mb-2 text-sm font-medium text-gray-700 dark:text-gray-300')">
      子组件正常渲染（{{ panelRows.length }} 项配置）
    </p>
    <div v-for="row in panelRows" :key="row.key" :class="rowClassName">
      <span :class="labelClassName">{{ row.label }}</span>
      <span :class="valueClassName">{{ row.value }}</span>
    </div>
  </div>
</template>
