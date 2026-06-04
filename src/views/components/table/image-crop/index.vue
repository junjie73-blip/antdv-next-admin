<script setup lang="ts">
import { isString } from 'es-toolkit'
import { computed, ref, useTemplateRef } from 'vue'
import { VueCropper } from 'vue-cropper'
import { cn } from '@/utils/cn'

type AspectRatioKey = 'free' | '1:1' | '16:9' | '4:3'

const containerClassName = cn('space-y-6')
const cropSectionClassName = cn('flex flex-col lg:flex-row gap-6')
const cropperPanelClassName = cn('flex-1 min-w-0')
const cropperWrapperClassName = cn('w-full h-[400px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700')
const controlPanelClassName = cn('w-full lg:w-72 shrink-0 space-y-5')
const controlCardClassName = cn('p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700')
const controlCardTitleClassName = cn('text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3')
const sliderRowClassName = cn('flex items-center gap-3')
const sliderLabelClassName = cn('text-xs text-gray-500 dark:text-gray-400 shrink-0 w-8')
const sliderClassName = cn('flex-1')
const sliderValueClassName = cn('text-xs text-gray-500 dark:text-gray-400 w-10 text-right tabular-nums')
const radioGroupClassName = cn('flex flex-wrap gap-2')
const radioBaseClassName = cn('px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer select-none')
const radioActiveClassName = cn('bg-blue-500 text-white border-blue-500')
const radioInactiveClassName = cn('bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400')
const rotateBtnGroupClassName = cn('flex gap-2')
const rotateBtnClassName = cn('flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer')
const actionBtnGroupClassName = cn('flex gap-2 flex-wrap')
const primaryBtnClassName = cn('inline-flex items-center gap-1 px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer')
const outlineBtnClassName = cn('inline-flex items-center gap-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer')
const uploadSectionClassName = cn('flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors')
const uploadIconClassName = cn('text-4xl text-gray-400 mb-2')
const uploadTextClassName = cn('text-gray-600 dark:text-gray-400')
const uploadHintClassName = cn('text-sm text-gray-400 dark:text-gray-500 mt-1')
const previewSectionClassName = cn('mt-4')
const previewTitleClassName = cn('text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3')
const previewGridClassName = cn('flex gap-4')
const previewBoxClassName = cn('w-40 h-40 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800')
const previewEmptyClassName = cn('flex items-center justify-center w-full h-full text-sm text-gray-400')
const previewImgClassName = cn('w-full h-full object-contain')
const dividerClassName = cn('border-t border-gray-200 dark:border-gray-700 my-2')

const cropperRef = useTemplateRef<InstanceType<typeof VueCropper>>('cropper')
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')

const imgSrc = ref('')
const cropResult = ref('')
const scaleValue = ref(0)
const currentRatio = ref<AspectRatioKey>('free')
const previewVisible = ref(true)

const ratioOptions: { key: AspectRatioKey, label: string, value?: [number, number] }[] = [
  { key: 'free', label: '自由' },
  { key: '1:1', label: '1:1', value: [1, 1] },
  { key: '16:9', label: '16:9', value: [16, 9] },
  { key: '4:3', label: '4:3', value: [4, 3] },
]

const fixedProps = computed(() => {
  const option = ratioOptions.find(r => r.key === currentRatio.value)
  if (option?.value) {
    return { fixed: true, fixedNumber: option.value }
  }
  return { fixed: false }
})

function getRatioClassName(key: AspectRatioKey) {
  return cn(radioBaseClassName, currentRatio.value === key ? radioActiveClassName : radioInactiveClassName)
}

function handleUpload() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (evt) => {
    const result = evt.target?.result
    if (isString(result)) {
      imgSrc.value = result
      cropResult.value = ''
      scaleValue.value = 0
    }
  }
  reader.readAsDataURL(file)
}

function handleZoomChange(value: number) {
  if (!cropperRef.value)
    return
  const delta = value - scaleValue.value
  cropperRef.value.changeScale(delta)
  scaleValue.value = value
}

function handleRotateLeft() {
  cropperRef.value?.rotateLeft()
}

function handleRotateRight() {
  cropperRef.value?.rotateRight()
}

function handleReset() {
  cropperRef.value?.refresh()
  scaleValue.value = 0
  cropResult.value = ''
}

function handleCrop() {
  cropperRef.value?.getCropData((data: string) => {
    cropResult.value = data
  })
}

function handleDownload() {
  if (!cropResult.value)
    return
  const link = document.createElement('a')
  link.download = 'cropped-image.png'
  link.href = cropResult.value
  link.click()
}

function handleRealTime(data: { w: number, h: number, url: string }) {
  if (previewVisible.value && data?.url) {
    cropResult.value = data.url
  }
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      variant="borderless"
      title="图片裁剪"
    >
      <p :class="cn('text-gray-600 dark:text-gray-400 mb-4')">
        上传图片后，使用下方工具进行裁剪操作，支持旋转、缩放、比例锁定等功能
      </p>

      <div
        v-if="!imgSrc"
        :class="uploadSectionClassName"
        @click="handleUpload"
      >
        <div :class="uploadIconClassName">
          📷
        </div>
        <p :class="uploadTextClassName">
          点击上传图片
        </p>
        <p :class="uploadHintClassName">
          支持 JPG、PNG、GIF 等常见格式
        </p>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        >
      </div>

      <div
        v-else
        :class="cropSectionClassName"
      >
        <div :class="cropperPanelClassName">
          <div :class="cropperWrapperClassName">
            <VueCropper
              ref="cropper"
              :img="imgSrc"
              :output-size="1"
              output-type="png"
              :info="true"
              :can-scale="true"
              :auto-crop="true"
              :auto-crop-width="300"
              :auto-crop-height="300"
              :fixed="fixedProps.fixed"
              :fixed-number="fixedProps.fixedNumber"
              :center-box="false"
              :info-true="true"
              :full="false"
              :can-move="true"
              :can-move-box="true"
              :original="false"
              mode="contain"
              @realTime="handleRealTime"
            />
          </div>

          <div :class="previewSectionClassName">
            <div :class="previewTitleClassName">
              裁剪预览
            </div>
            <div :class="previewGridClassName">
              <div :class="previewBoxClassName">
                <img
                  v-if="cropResult"
                  :src="cropResult"
                  :class="previewImgClassName"
                  alt="裁剪预览"
                >
                <div
                  v-else
                  :class="previewEmptyClassName"
                >
                  暂无预览
                </div>
              </div>
            </div>
          </div>
        </div>

        <div :class="controlPanelClassName">
          <div :class="controlCardClassName">
            <div :class="controlCardTitleClassName">
              缩放
            </div>
            <div :class="sliderRowClassName">
              <span :class="sliderLabelClassName">缩小</span>
              <a-slider
                :class="sliderClassName"
                :min="-100"
                :max="100"
                :value="scaleValue"
                @change="handleZoomChange"
              />
              <span :class="sliderValueClassName">{{ scaleValue > 0 ? '+' : '' }}{{ scaleValue }}</span>
            </div>
          </div>

          <div :class="controlCardClassName">
            <div :class="controlCardTitleClassName">
              旋转
            </div>
            <div :class="rotateBtnGroupClassName">
              <button
                :class="rotateBtnClassName"
                @click="handleRotateLeft"
              >
                ↺ 左转
              </button>
              <button
                :class="rotateBtnClassName"
                @click="handleRotateRight"
              >
                ↻ 右转
              </button>
            </div>
          </div>

          <div :class="controlCardClassName">
            <div :class="controlCardTitleClassName">
              裁剪比例
            </div>
            <div :class="radioGroupClassName">
              <span
                v-for="ratio in ratioOptions"
                :key="ratio.key"
                :class="getRatioClassName(ratio.key)"
                @click="currentRatio = ratio.key"
              >
                {{ ratio.label }}
              </span>
            </div>
          </div>

          <div :class="cn(controlCardClassName, 'flex items-center justify-between')">
            <span :class="cn('text-sm text-gray-600 dark:text-gray-400')">实时预览</span>
            <a-switch v-model:checked="previewVisible" />
          </div>

          <div :class="dividerClassName" />

          <div :class="actionBtnGroupClassName">
            <button
              :class="primaryBtnClassName"
              @click="handleCrop"
            >
              确认裁剪
            </button>
            <button
              :class="outlineBtnClassName"
              @click="handleDownload"
            >
              下载图片
            </button>
            <button
              :class="outlineBtnClassName"
              @click="handleReset"
            >
              重置
            </button>
            <button
              :class="outlineBtnClassName"
              @click="imgSrc = ''; cropResult = ''; scaleValue = 0"
            >
              重新上传
            </button>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>
