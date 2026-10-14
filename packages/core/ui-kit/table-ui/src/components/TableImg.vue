<script setup lang="ts">
import { computed } from 'vue';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

const props = withDefaults(
  defineProps<{
    imgList?: string[];
    size?: number;
    margin?: number;
    simpleShow?: boolean;
  }>(),
  {
    imgList: () => [],
    size: 40,
    margin: 8,
    simpleShow: false,
  },
);

const showImgList = computed(() => {
  if (props.simpleShow && props.imgList && props.imgList.length > 0) {
    return [props.imgList[0]];
  }
  return props.imgList || [];
});

const imgStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  objectFit: 'cover' as const,
}));
</script>

<template>
  <div :class="cn('flex items-center')" :style="{ gap: `${margin}px` }">
    <Dialog v-for="(img, index) in showImgList" :key="index">
      <DialogTrigger as-child>
        <img
          :src="img"
          :style="imgStyle"
          :class="
            cn(
              'cursor-pointer rounded border border-gray-200 transition-all',
              'hover:border-primary-500 hover:shadow-md',
              'dark:hover:border-primary-400 dark:border-gray-700',
            )
          "
          alt=""
        />
      </DialogTrigger>
      <DialogContent
        :class="
          cn('max-w-[90vw] sm:max-w-[720px] bg-transparent border-none shadow-none')
        "
      >
        <img :src="img" :class="cn('w-full rounded')" alt="" />
      </DialogContent>
    </Dialog>
    <span
      v-if="simpleShow && imgList && imgList.length > 1"
      :class="cn('text-sm text-gray-400 dark:text-gray-500')"
    >
      +{{ imgList.length - 1 }}
    </span>
  </div>
</template>
