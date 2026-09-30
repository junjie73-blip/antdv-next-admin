<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, nextTick, ref, watch } from 'vue'
import 'vue-cropper/dist/index.css'
import { VueCropper } from 'vue-cropper'

import { uploadFile } from '~/api'

interface Props {
  modelValue?: string
  /** 上传尺寸限制，MB */
  maxSizeMb?: number
  /** 输出尺寸（px），默认 256x256 */
  outputSize?: number
  /** 圆形预览 */
  round?: boolean
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  maxSizeMb: 5,
  outputSize: 256,
  round: true,
  size: 80,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  uploaded: [url: string]
}>()

const visible = ref(false)
const uploading = ref(false)
const imgSrc = ref('')
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null)

const previewStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: props.round ? '50%' : '8px',
}))

// 打开裁剪
function beforeUpload(file: File): boolean {
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type)
  if (!isImage) {
    message.error('仅支持 JPG / PNG / WebP / GIF')
    return false
  }
  if (file.size / 1024 / 1024 > props.maxSizeMb) {
    message.error(`图片大小不能超过 ${props.maxSizeMb}MB`)
    return false
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    imgSrc.value = String(e.target?.result ?? '')
    visible.value = true
    nextTick(() => {
      cropperRef.value?.refresh?.()
    })
  }
  reader.readAsDataURL(file)
  return false // 阻止 a-upload 默认上传
}

// 确认裁剪 → 上传
async function handleConfirm() {
  if (!cropperRef.value) return
  uploading.value = true
  try {
    const blob: Blob = await new Promise((resolve, reject) => {
      cropperRef.value!.getCropBlob((data: Blob) => {
        if (data && data.size > 0) resolve(data)
        else reject(new Error('裁剪失败'))
      })
    })

    const file = new File([blob], `avatar_${Date.now()}.png`, {
      type: 'image/png',
    })
    const res: any = await uploadFile(file)
    const url = res?.data?.url || res?.url
    if (!url) throw new Error('上传接口未返回 url')

    emit('update:modelValue', url)
    emit('uploaded', url)
    message.success('头像上传成功')
    visible.value = false
  } catch (e: any) {
    message.error(e?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

watch(visible, (v) => {
  if (!v) imgSrc.value = ''
})
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- 头像预览 -->
    <a-avatar :size="size" :src="modelValue" :style="previewStyle" class="bg-slate-100 dark:bg-slate-800">
      <template v-if="!modelValue">
        <Icon icon="carbon:user-avatar" class="text-3xl text-gray-400" />
      </template>
    </a-avatar>

    <!-- 上传按钮 -->
    <a-upload
      :show-upload-list="false"
      accept="image/jpeg,image/png,image/webp,image/gif"
      :before-upload="beforeUpload"
    >
      <a-button>
        <template #icon><Icon icon="carbon:upload" /></template>
        {{ modelValue ? '更换头像' : '上传头像' }}
      </a-button>
    </a-upload>

    <!-- 裁剪弹窗 -->
    <a-modal
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
          拖动/缩放选择裁剪区域，将按 1:1 输出 {{ outputSize }}x{{ outputSize }} PNG
        </div>
      </div>
    </a-modal>
  </div>
</template>
