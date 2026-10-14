<script setup lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue';

import { computed, ref, watch } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'Image' });

const props = withDefaults(
  defineProps<{
    alt?: string;
    class?: HTMLAttributes['class'];
    fallback?: string;
    height?: number | string;
    preview?: boolean | ImagePreviewConfig;
    rootClassName?: string;
    src?: string;
    style?: CSSProperties;
    width?: number | string;
  }>(),
  {
    alt: '',
    class: undefined,
    fallback: undefined,
    height: undefined,
    preview: true,
    rootClassName: undefined,
    src: undefined,
    style: undefined,
    width: undefined,
  },
);

const emit = defineEmits<{ 'update:previewVisible': [boolean] }>();

interface ImagePreviewConfig {
  onVisibleChange?: (visible: boolean) => void;
  visible?: boolean;
}

const config = computed(() =>
  typeof props.preview === 'object' && props.preview !== null
    ? props.preview
    : undefined,
);

/** `preview={{ visible: false }}` 且无回调时按静态关闭预览处理（迁移前的隐藏预览用法） */
const showPreview = computed(() => {
  if (props.preview === false) return false;
  if (!config.value) return Boolean(props.preview);
  return !(config.value.visible === false && !config.value.onVisibleChange);
});

/** `visible` 为布尔值时由外层接管开关，每次切换回调 onVisibleChange */
const controlled = computed(() => typeof config.value?.visible === 'boolean');

const innerOpen = ref(false);
const dialogOpen = computed(() =>
  controlled.value ? Boolean(config.value?.visible) : innerOpen.value,
);

function setOpen(next: boolean) {
  if (!showPreview.value) return;
  if (!controlled.value) innerOpen.value = next;
  config.value?.onVisibleChange?.(next);
  emit('update:previewVisible', next);
}

function openPreview() {
  if (!showPreview.value || dialogOpen.value) return;
  setOpen(true);
}

const broken = ref(false);
watch(
  () => props.src,
  () => {
    broken.value = false;
  },
);

const currentSrc = computed(() =>
  broken.value && props.fallback ? props.fallback : props.src,
);

function onError() {
  if (props.fallback && !broken.value) broken.value = true;
}

function toCssSize(value?: number | string) {
  return typeof value === 'number' ? `${value}px` : value;
}

const sizeStyle = computed<CSSProperties>(() => ({
  height: toCssSize(props.height),
  width: toCssSize(props.width),
}));

const rootClass = computed(() =>
  cn(
    'group relative inline-block overflow-hidden',
    showPreview.value && 'cursor-pointer',
    props.rootClassName,
    // 放在最后：外层传入的类名要能覆盖上面的默认布局
    props.class
  )
);
</script>

<template>
  <div data-common-image :class="rootClass" @click="openPreview">
    <img
      :alt="props.alt"
      :src="currentSrc"
      :style="[sizeStyle, props.style]"
      class="block max-w-full object-cover"
      @error="onError"
    />
    <div
      v-if="showPreview"
      data-common-image-trigger
      class="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
    >
      <Icon icon="carbon:zoom-in" class="text-xl text-white" />
    </div>
  </div>

  <Dialog v-if="showPreview" :open="dialogOpen" @update:open="setOpen">
    <DialogContent
      data-common-image-preview
      class="max-w-4xl border-0 bg-black/70 shadow-none"
    >
      <DialogTitle class="sr-only">{{ props.alt || '图片预览' }}</DialogTitle>
      <DialogDescription class="sr-only">图片预览</DialogDescription>
      <img
        :alt="props.alt"
        :src="currentSrc"
        class="mx-auto max-h-[80vh] w-auto object-contain"
      />
    </DialogContent>
  </Dialog>
</template>
