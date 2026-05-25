<script setup lang="ts">
import { cn } from '@/utils/cn'
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const containerClassName = cn('space-y-6')

const imageGridClassName = cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4')
const thumbnailClassName = cn('w-full h-32 rounded-lg cursor-pointer transition-transform hover:scale-105 flex items-center justify-center text-white text-sm font-medium')
const uploadAreaClassName = cn('border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors')

const placeholderColors = ['bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400', 'bg-teal-400', 'bg-cyan-400', 'bg-indigo-400', 'bg-red-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-lime-400']

function getPlaceholderColor(seed: number) {
  return placeholderColors[seed % placeholderColors.length]
}

const imageData = ref([
  { id: 1, title: '风景照片', size: '400x300', type: '风景' },
  { id: 2, title: '人物肖像', size: '400x300', type: '人像' },
  { id: 3, title: '建筑摄影', size: '400x300', type: '建筑' },
  { id: 4, title: '美食特写', size: '400x300', type: '美食' },
  { id: 5, title: '动物世界', size: '400x300', type: '动物' },
  { id: 6, title: '城市夜景', size: '400x300', type: '城市' },
])

const previewVisible = ref(false)
const previewImage = ref('')
const previewTitle = ref('')

function handlePreview(image: { id: number; title: string }) {
  previewImage.value = image.title
  previewTitle.value = image.title
  previewVisible.value = true
}

function handlePreviewCancel(visible: boolean) {
  previewVisible.value = visible
}

const uploadedImages = ref<number[]>([])

function handleCustomUpload() {
  const seed = Date.now()
  uploadedImages.value.push(seed)
}

const cropMode = ref(false)
const cropImageId = ref(0)
const cropResult = ref('')

function startCrop(imageId: number) {
  cropImageId.value = imageId
  cropMode.value = true
  setTimeout(() => {
    cropResult.value = `cropped_${imageId}`
  }, 500)
}

function cancelCrop() {
  cropMode.value = false
  cropImageId.value = 0
  cropResult.value = ''
}

const lazyLoadImages = ref(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: `懒加载图片${i + 1}`,
  })),
)

const sizeVariants = ref([
  { label: '小尺寸', size: '100x80' },
  { label: '中等尺寸', size: '200x150' },
  { label: '大尺寸', size: '400x300' },
  { label: '原图', size: '800x600' },
])
</script>

<template>
  <div :class="containerClassName">
    <a-card variant="borderless" title="图片列表展示">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        表格中的图片列以缩略图形式展示，支持点击预览大图
      </p>
      <div :class="imageGridClassName">
        <div
          v-for="image in imageData"
          :key="image.id"
          class="relative group"
          @click="handlePreview(image)"
        >
          <div :class="[thumbnailClassName, getPlaceholderColor(image.id)]">
            {{ image.title }}
          </div>
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-lg flex items-center justify-center">
            <Icon icon="carbon:zoom-in" class="text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div class="mt-2 text-center">
            <p class="text-sm font-medium">{{ image.title }}</p>
            <p class="text-xs text-gray-500">{{ image.size }} · {{ image.type }}</p>
          </div>
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="图片预览大图">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        使用 a-image 组件的 preview 功能，点击下方图片查看大图预览效果
      </p>
      <div class="flex gap-4 flex-wrap">
        <div
          v-for="image in imageData.slice(0, 3)"
          :key="image.id"
          :style="{ width: '200px', height: '150px' }"
          :class="[cn('rounded-lg overflow-hidden cursor-pointer'), getPlaceholderColor(image.id), cn('flex items-center justify-center text-white font-medium')]"
          @click="handlePreview(image)"
        >
          {{ image.title }}
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="Antdv Image 内置预览">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        使用 antdv-next 的 a-image 组件内置的预览功能
      </p>
      <div class="flex gap-4 flex-wrap">
        <div
          v-for="image in imageData.slice(0, 4)"
          :key="image.id"
          :style="{ width: '180px', height: '135px' }"
          :class="[cn('rounded-lg overflow-hidden'), getPlaceholderColor(image.id), cn('flex items-center justify-center text-white font-medium')]"
        >
          {{ image.title }}
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="图片上传与回显">
      <div :class="uploadAreaClassName" @click="handleCustomUpload">
        <Icon icon="carbon:cloud-upload" class="text-4xl text-gray-400 mb-2" />
        <p class="text-gray-600">点击或拖拽上传图片</p>
        <p class="text-sm text-gray-400 mt-1">支持 JPG、PNG、GIF 格式</p>
      </div>
      <div v-if="uploadedImages.length > 0" class="mt-4">
        <h4 class="font-medium mb-2">已上传图片：</h4>
        <div :class="imageGridClassName">
          <div v-for="(seed, index) in uploadedImages" :key="index" class="relative group">
            <div :class="[thumbnailClassName, getPlaceholderColor(seed)]">
              图片{{ index + 1 }}
            </div>
            <button
              class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              @click="uploadedImages.splice(index, 1)"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="图片裁剪功能">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        点击图片开始裁剪操作（模拟裁剪流程）
      </p>
      <div v-if="!cropMode" :class="imageGridClassName">
        <div
          v-for="image in imageData.slice(0, 4)"
          :key="image.id"
          class="relative group cursor-pointer"
          @click="startCrop(image.id)"
        >
          <div :class="[thumbnailClassName, getPlaceholderColor(image.id)]">
            {{ image.title }}
          </div>
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-lg flex items-center justify-center">
            <div class="text-center text-white opacity-0 group-hover:opacity-100 transition">
              <Icon icon="carbon:crop" class="text-2xl mx-auto mb-1" />
              <p class="text-sm">点击裁剪</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="space-y-4">
        <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="flex-1">
            <h4 class="font-medium mb-2">原始图片</h4>
            <div :class="[cn('max-w-full h-auto rounded'), getPlaceholderColor(cropImageId), cn('flex items-center justify-center text-white')]" style="width: 200px; height: 150px;">
              原始图片 #{{ cropImageId }}
            </div>
          </div>
          <div class="text-2xl text-gray-400">→</div>
          <div class="flex-1">
            <h4 class="font-medium mb-2">裁剪结果</h4>
            <div v-if="cropResult" class="bg-white dark:bg-gray-700 p-4 rounded inline-block">
              <div :class="[cn('w-48 h-48 object-cover rounded'), getPlaceholderColor(cropImageId), cn('flex items-center justify-center text-white')]">
                {{ cropResult }}
              </div>
            </div>
            <div v-else class="w-48 h-48 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
              <a-spin />
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <a-button type="primary">
            确认裁剪
          </a-button>
          <a-button @click="cancelCrop">
            取消
          </a-button>
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="图片懒加载">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        使用原生 loading="lazy" 实现图片懒加载，滚动到可视区域时自动加载
      </p>
      <div :class="imageGridClassName">
        <div v-for="image in lazyLoadImages" :key="image.id">
          <div :class="[thumbnailClassName, getPlaceholderColor(image.id)]">
            {{ image.title }}
          </div>
          <p class="text-sm text-center mt-2 text-gray-600">{{ image.title }}</p>
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" title="不同尺寸展示方案">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        根据不同场景选择合适的图片尺寸，优化加载性能和用户体验
      </p>
      <div class="space-y-6">
        <div v-for="(variant, index) in sizeVariants" :key="variant.label" class="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div :class="[cn('rounded-lg shadow'), getPlaceholderColor(index)]" :style="{ width: variant.size.split('x')[0] + 'px', height: variant.size.split('x')[1] + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }">
            {{ variant.label }}
          </div>
          <div>
            <h4 class="font-medium">{{ variant.label }}</h4>
            <p class="text-sm text-gray-600 mt-1">尺寸：{{ variant.size }}</p>
            <p class="text-sm text-gray-500 mt-1">
              适用场景：
              {{ variant.label === '小尺寸' ? '头像、图标、缩略图' : '' }}
              {{ variant.label === '中等尺寸' ? '卡片封面、列表项' : '' }}
              {{ variant.label === '大尺寸' ? '详情页主图、Banner' : '' }}
              {{ variant.label === '原图' ? '高清展示、打印输出' : '' }}
            </p>
          </div>
        </div>
      </div>
    </a-card>

    <a-image
      :style="{ display: 'none' }"
      :preview-visible="previewVisible"
      :src="previewImage"
      @update:preview-visible="handlePreviewCancel"
    />
  </div>
</template>
