<script setup lang="ts">
import { Icon } from '@iconify/vue';

import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetSearch' });

const emit = defineEmits<{ open: [] }>();

// Ctrl+K / Cmd+K 的监听在 `LayoutHeader` 上（外壳一挂载就生效），
// 这里只保留"点按钮"这一条路径 —— 以前两边各绑一份，异步挂载的小部件还没落地时
// 快捷键就是空穴，而且两处逻辑迟早漂移。
</script>

<template>
  <WidgetButton label="搜索菜单（Ctrl+K）" @click="emit('open')">
    <Icon icon="carbon:search" class="text-lg" />
  </WidgetButton>
</template>
