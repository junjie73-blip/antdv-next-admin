<script setup lang="ts">
import { Image, Space } from 'antdv-next'
import { computed } from 'vue'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{
  /** 图片列表 */
  imgList?: string[]
  /** 图片大小 */
  size?: number
  /** 图片间距 */
  margin?: number
  /** 简单展示（只显示一张） */
  simpleShow?: boolean
}>(), {
  size: 40,
  margin: 8,
  simpleShow: false,
})

// 显示的图片列表
const showImgList = computed(() => {
  if (props.simpleShow && props.imgList && props.imgList.length > 0) {
    return [props.imgList[0]]
  }
  return props.imgList || []
})

// 图片样式
const imgStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  objectFit: 'cover' as const,
}))
</script>

<template>
  <Space :size="margin">
    <Image
      v-for="(img, index) in showImgList"
      :key="index"
      :src="img"
      :width="size"
      :height="size"
      :style="imgStyle"
      :class="cn('rounded border border-gray-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all')"
    />
    <span
      v-if="simpleShow && imgList && imgList.length > 1"
      :class="cn('text-gray-400 text-sm')"
    >
      +{{ imgList.length - 1 }}
    </span>
  </Space>
</template>
