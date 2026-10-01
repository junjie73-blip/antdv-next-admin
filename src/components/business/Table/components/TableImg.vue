<script setup lang="ts">
import { Image, Space } from 'antdv-next'
import { computed } from 'vue'

import { cn } from '~/utils/cn'

const props = withDefaults(
  defineProps<{
    imgList?: string[]
    size?: number
    margin?: number
    simpleShow?: boolean
  }>(),
  {
    size: 40,
    margin: 8,
    simpleShow: false,
  },
)

const showImgList = computed(() => {
  if (props.simpleShow && props.imgList && props.imgList.length > 0) {
    return [props.imgList[0]]
  }
  return props.imgList || []
})

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
      :class="
        cn(
          'cursor-pointer rounded border border-gray-200 transition-all',
          'hover:border-ant-primary-500 hover:shadow-md',
          'dark:hover:border-ant-primary-400 dark:border-gray-700',
        )
      "
    />
    <span v-if="simpleShow && imgList && imgList.length > 1" :class="cn('text-sm text-gray-400 dark:text-gray-500')">
      +{{ imgList.length - 1 }}
    </span>
  </Space>
</template>
