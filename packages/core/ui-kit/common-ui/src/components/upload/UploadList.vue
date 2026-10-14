<script setup lang="ts">
import type { UploadFile, UploadListType } from './types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Progress } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'UploadList' });

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    items?: UploadFile[];
    listType?: UploadListType;
    showRemoveIcon?: boolean;
  }>(),
  {
    disabled: false,
    items: () => [],
    listType: 'text',
    showRemoveIcon: true,
  },
);

const emit = defineEmits<{
  preview: [UploadFile, MouseEvent];
  remove: [UploadFile];
  retry: [UploadFile];
}>();

const isCard = computed(() => props.listType === 'picture-card');

const listClass = computed(() =>
  cn(isCard.value ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1 text-sm'),
);

const itemClass = computed(() =>
  cn(
    'group flex items-center gap-2 rounded px-2 py-1 transition-colors',
    isCard.value
      ? 'flex-col items-stretch border border-gray-200 p-0 dark:border-gray-700'
      : 'hover:bg-gray-50 dark:hover:bg-gray-800',
  ),
);

/** 状态色：uploading 蓝、error 红、done 绿，抽成 computed 避免模板里写 cn(...) */
const statusTextClass = computed(() =>
  cn('min-w-0 flex-1 truncate'),
);

function thumbOf(file: UploadFile) {
  return file.thumbUrl ?? file.url ?? '';
}

function onPreview(file: UploadFile, event: MouseEvent) {
  emit('preview', file, event);
}
</script>

<template>
  <div data-common-upload-list :class="listClass">
    <div
      v-for="file in props.items"
      :key="file.uid"
      data-common-upload-item
      :class="itemClass"
    >
      <!-- 图片模式：卡片是 96px 方格并带遮罩预览，普通图片模式只画小缩略图 -->
      <component
        :is="isCard ? 'div' : 'span'"
        v-if="listType !== 'text'"
        class="relative shrink-0 overflow-hidden"
        :class="
          isCard
            ? 'size-24 cursor-pointer'
            : 'flex items-center gap-2'
        "
        @click="isCard ? onPreview(file, $event) : undefined"
      >
        <img
          v-if="thumbOf(file)"
          :src="thumbOf(file)"
          :alt="file.name"
          class="size-full object-cover"
        />
      </component>

      <div :class="cn('min-w-0 flex-1', isCard ? 'px-2 py-1' : '')">
        <span :class="statusTextClass" :title="file.name">{{ file.name }}</span>

        <!-- 上传中：进度条 + 百分比 -->
        <div
          v-if="file.status === 'uploading'"
          class="flex items-center gap-2"
        >
          <Progress :model-value="file.percent ?? 0" class="h-1.5 flex-1" />
          <span class="w-10 text-right text-xs text-gray-500">
            {{ Math.round(file.percent ?? 0) }}%
          </span>
        </div>
      </div>

      <!-- done：绿色对勾 -->
      <Icon
        v-if="file.status === 'done'"
        icon="ant-design:check-outlined"
        class="shrink-0 text-green-500"
      />

      <!-- error：红色重试 + 关闭 -->
      <template v-else-if="file.status === 'error'">
        <Icon
          icon="ant-design:reload-outlined"
          class="shrink-0 cursor-pointer text-gray-400 hover:text-primary"
          @click="emit('retry', file)"
        />
        <span class="shrink-0 text-red-500">
          <Icon icon="ant-design:close-circle-filled" />
        </span>
      </template>

      <!-- × 移除 -->
      <button
        v-if="showRemoveIcon && !disabled"
        type="button"
        class="shrink-0 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
        :aria-label="`移除 ${file.name}`"
        @click="emit('remove', file)"
      >
        <Icon icon="ant-design:close-outlined" />
      </button>
    </div>
  </div>
</template>
