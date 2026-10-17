<script setup lang="ts">
import type { ModalInnerMethods, ModalMethods } from '@antdv/popup-ui';

import { computed, nextTick, ref, watch } from 'vue';
import { VueCropper } from 'vue-cropper';
import 'vue-cropper/dist/index.css';

import { useFileReader } from '@antdv/hooks/use-file-reader';
import { BasicModal, message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { useFileDialog } from '@vueuse/core';
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
const modalApi = ref<(ModalInnerMethods & ModalMethods) | null>(null);

const { read: readFile } = useFileReader();
const imgSrc = ref<null | string>(null);

const previewStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: props.round ? '50%' : '8px',
}));

/** 校验并读取为 DataURL 后打开裁剪弹窗（等价旧的 beforeUpload，始终不自动上传） */
function handleFile(file: File) {
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
  if (!isImage) {
    message.error('仅支持 JPG / PNG / WebP / GIF');
    return;
  }
  if (file.size / 1024 / 1024 > props.maxSizeMb) {
    message.error(`图片大小不能超过 ${props.maxSizeMb}MB`);
    return;
  }

  // useFileReader 读取为 DataURL
  readFile(file).then((data) => {
    imgSrc.value = typeof data === 'string' ? data : null;
    visible.value = true;
    nextTick(() => {
      cropperRef.value?.refresh?.();
    });
  });
}

// 选文件通道：vueuse useFileDialog 替代 antdv Upload
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const { open: openPicker, onChange: onPicked } = useFileDialog({
  accept: ACCEPT,
  multiple: false,
  reset: true,
});
onPicked((picked: FileList | null) => {
  const file = Array.from(picked ?? [])[0];
  if (file) handleFile(file);
});

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
    // BasicModal 内部点确认会置 ok loading，成功后随弹窗关闭，失败时手动复位
    modalApi.value?.changeOkLoading(false);
  }
}

watch(visible, (v) => {
  if (!v) imgSrc.value = null;
});
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- 圆形预览容器：自建，保持 size / round / 占位图标与迁移前一致 -->
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800"
      :style="previewStyle"
    >
      <img
        v-if="modelValue"
        :src="modelValue"
        alt="avatar"
        class="size-full object-cover"
      />
      <Icon v-else icon="carbon:user-avatar" class="text-3xl text-gray-400" />
    </div>

    <Button @click="openPicker()">
      <Icon icon="carbon:upload" />
      {{ modelValue ? '更换头像' : '上传头像' }}
    </Button>

    <BasicModal
      v-model:open="visible"
      title="裁剪头像"
      :width="480"
      ok-text="确认上传"
      cancel-text="取消"
      :ok-button-props="{ loading: uploading }"
      @register="(api: any) => (modalApi = api)"
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
    </BasicModal>
  </div>
</template>
