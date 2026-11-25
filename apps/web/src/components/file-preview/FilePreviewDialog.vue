<script setup lang="ts">
/** 预览弹窗壳：统一标题、格式徽标、下载与关闭行为，内容交给 FilePreview。 */
import { computed } from 'vue';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

import FilePreview from './FilePreview.vue';

defineOptions({ name: 'FilePreviewDialog' });

const props = withDefaults(
  defineProps<{
    open: boolean;
    source: File | null | string;
    name?: string;
  }>(),
  { name: '' },
);
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>();

const resolvedName = computed(() => {
  if (props.name) return props.name;
  if (props.source instanceof File) return props.source.name;
  return (
    String(props.source ?? '')
      .split('/')
      .pop() ?? '文件'
  );
});

function download() {
  if (!props.source) return;
  const url =
    props.source instanceof File
      ? URL.createObjectURL(props.source)
      : String(props.source);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resolvedName.value;
  anchor.click();
  if (props.source instanceof File) URL.revokeObjectURL(url);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      v-if="source"
      class="max-h-[88vh] max-w-[min(900px,calc(100vw-32px))] overflow-hidden p-4"
    >
      <DialogHeader class="space-y-1">
        <DialogTitle class="truncate pr-8 text-base">
{{
          resolvedName
        }}
</DialogTitle>
        <DialogDescription class="sr-only">文件内容预览</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-hidden">
        <FilePreview
          :key="resolvedName"
          :source="source"
          :name="resolvedName"
        />
      </div>
      <div class="flex justify-end border-t pt-2">
        <Button variant="outline" size="sm" @click="download">
          <Icon icon="carbon:download" class="mr-1 size-4" />
          下载
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
