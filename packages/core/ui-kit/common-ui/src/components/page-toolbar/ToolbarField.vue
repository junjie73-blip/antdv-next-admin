<script setup lang="ts">
import type { ToolbarFieldProps } from './types';

defineOptions({ name: 'ToolbarField' });

const props = withDefaults(defineProps<ToolbarFieldProps>(), {
  label: '',
});
</script>

<template>
  <!--
    一个筛选项 = 标签 + 控件。

    存在的理由只有一个：标签的字号、颜色和与控件的间距原来每页各写一遍，
    同一个"状态"标签在三页里是三种灰。
  -->
  <div class="flex items-center gap-2" data-page="toolbar-field">
    <span
      v-if="props.label"
      class="text-muted-foreground shrink-0 text-sm"
      data-page="toolbar-field-label"
    >
      {{ props.label }}
    </span>
    <slot></slot>
  </div>
</template>
