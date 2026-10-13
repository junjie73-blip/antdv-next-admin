<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { VueCropper } from 'vue-cropper';
import 'vue-cropper/dist/index.css';

import { useFileReader } from '@antdv/composables/useFileReader';
import { Icon } from '@iconify/vue';
import { Avatar as AAvatar, Button as AButton, Modal as AModal, Upload as AUpload, message } from 'antdv-next';
import { http } from '~/composables';

interface Props {
  modelValue?: string;
  maxSizeMb?: number;
  outputSize?: number;
  round?: boolean;
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  maxSizeMb: 5,
  outputSize: 256,
  round: true,
  size: 80,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  uploaded: [url: string];
}>();

const visible = ref(false);
const uploading = ref(false);
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null);

const { result: imgSrc, read: readFile } = useFileReader();

const previewStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: props.round ? '50%' : '8px',
}));

function beforeUpload(file: File): boolean {
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
  if (!isImage) {
    message.error('仅支持 JPG / PNG / WebP / GIF');
    return false;
  }
  if (file.size / 1024 / 1024 > props.maxSizeMb) {
    message.error(`图片大小不能超过 ${props.maxSizeMb}MB`);
    return false;
  }

  // useFileReader 读取为 DataURL
  readFile(file).then(() => {
    visible.value = true;
    nextTick(() => {
      cropperRef.value?.refresh?.();
    });
  });

  return false;
}

async function handleConfirm() {
  if (!cropperRef.value) return;
  uploading.value = true;
  try {
    const blob: Blob = await new Promise((resolve, reject) => {
      cropperRef.value!.getCropBlob((data: Blob) => {
        if (data && data.size > 0) resolve(data);
        else reject(new Error('裁剪失败'));
      });
    });

    const file = new File([blob], `avatar_${Date.now()}.png`, {
      type: 'image/png',
    });
    // 走真实文件上传（multipart）而不是 `~/api/system` 的 `uploadFile`：
    // 后者是文件管理页的**元数据登记**接口，POST 的是 JSON 描述、返回的记录里没有 url，
    // 用它上传头像永远拿不到可回填的地址。
    const formData = new FormData();
    formData.append('file', file);
    const res = await http.Post<{
      code: number;
      data: { url: string };
      message?: string;
    }>('/upload/avatar', formData);
    const url = res?.data?.url;
    if (!url) throw new Error('上传接口未返回 url');

    emit('update:modelValue', url);
    emit('uploaded', url);
    message.success('头像上传成功');
    visible.value = false;
  } catch (error: any) {
    message.error(error?.message || '上传失败');
  } finally {
    uploading.value = false;
  }
}

watch(visible, (v) => {
  if (!v) imgSrc.value = null;
});
</script>

<template>
  <div class="flex items-center gap-4">
    <AAvatar
      :size="size"
      :src="modelValue"
      :style="previewStyle"
      class="bg-slate-100 dark:bg-slate-800"
    >
      <template v-if="!modelValue">
        <Icon icon="carbon:user-avatar" class="text-3xl text-gray-400" />
      </template>
    </AAvatar>

    <AUpload
      :show-upload-list="false"
      accept="image/jpeg,image/png,image/webp,image/gif"
      :before-upload="beforeUpload"
    >
      <AButton>
        <template #icon><Icon icon="carbon:upload" /></template>
        {{ modelValue ? '更换头像' : '上传头像' }}
      </AButton>
    </AUpload>

    <AModal
      v-model:open="visible"
      title="裁剪头像"
      :width="480"
      :confirm-loading="uploading"
      ok-text="确认上传"
      cancel-text="取消"
      @ok="handleConfirm"
    >
      <div class="flex flex-col items-center gap-4 py-2">
        <div class="relative h-80 w-80 overflow-hidden rounded-lg bg-slate-900">
          <VueCropper
            v-if="imgSrc"
            ref="cropperRef"
            :img="imgSrc"
            :auto-crop="true"
            :center-box="true"
            :fixed="true"
            :fixed-number="[1, 1]"
            :info="true"
            :can-move="true"
            :can-move-box="true"
            :can-zoom="true"
            :full="false"
            :output-size="1"
            output-type="png"
          />
        </div>
        <div class="text-xs text-gray-500">
          拖动/缩放选择裁剪区域，将按 1:1 输出 {{ outputSize }}x{{ outputSize }}
          PNG
        </div>
      </div>
    </AModal>
  </div>
</template>
