<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import dayjs from 'dayjs';
import { cn } from '~/utils/cn';

defineOptions({ name: 'ScreenHeader' });

const props = withDefaults(
  defineProps<{
    /** 大屏标题 */
    title?: string;
    /** 是否显示全屏按钮 */
    showFullscreen?: boolean;
  }>(),
  {
    title: '数据监控中心',
    showFullscreen: true,
  },
);

const containerClassName = cn(
  'flex h-14 items-center justify-between px-6 select-none',
  'bg-linear-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10',
  'border-b border-blue-500/20',
);
const titleClassName = cn(
  'flex items-center gap-2 text-xl font-bold tracking-wider text-white',
);
const timeClassName = cn('font-mono text-sm text-blue-200/80 tabular-nums');
const actionBtnClassName = cn(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-1 text-xs transition-all duration-200',
  'border-blue-500/30 text-blue-300/70 hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-blue-100',
);

const currentTime = ref('');
const isFullscreen = ref(false);
let timer: null | ReturnType<typeof setInterval> = null;

function updateTime() {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss dddd');
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    isFullscreen.value = false;
  } else {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  }
}

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement;
  });
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  document.removeEventListener('fullscreenchange', () => {});
});
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧：标题 -->
    <div :class="titleClassName">
      <span class="h-6 w-1.5 rounded-full bg-blue-400"></span>
      {{ title }}
      <span class="ml-2 text-[10px] tracking-widest text-blue-300/50">SECURITY MONITOR</span>
    </div>

    <!-- 中间：时间 -->
    <div class="absolute left-1/2 -translate-x-1/2">
      <div :class="timeClassName">
        {{ currentTime }}
      </div>
    </div>

    <!-- 右侧：操作按钮 -->
    <div v-if="showFullscreen" class="flex items-center gap-3">
      <button :class="actionBtnClassName" @click="toggleFullscreen">
        <FullscreenOutlined v-if="!isFullscreen" class="text-xs" />
        <FullscreenExitOutlined v-else class="text-xs" />
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
      <button :class="actionBtnClassName">
        <SettingOutlined class="text-xs" />
        设置
      </button>
    </div>
  </div>
</template>
