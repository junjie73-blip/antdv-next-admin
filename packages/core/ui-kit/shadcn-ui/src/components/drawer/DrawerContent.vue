<script lang="ts" setup>
import type { DrawerContentEmits, DrawerContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  DrawerContent,
  DrawerHandle,
  DrawerPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from '@antdv/shared/utils/cn'
import DrawerOverlay from "./DrawerOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DrawerContentProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<DrawerContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

/**
 * 甩动位移写 `translate`，开关动画的 keyframes 写 `transform`（tw-animate-css 的
 * enter/exit 动的是 transform），两条各占一个属性才互不顶掉：都挂在 transform 上时，
 * 动画结束那一刻声明值会重新接管，`transition-transform` 于是把它当一次位移来补间，
 * 面板就"再滑一下"。`will-change` 只在拖拽期间提层：面板是铺满一侧的大元素，
 * 常驻会长期占一个合成层。
 *
 * 这份名单写在 script 里而不是模板里：Vue 的模板表达式解析器不接受跨行的 `//` 注释。
 */
const contentClass = computed(() =>
  cn(
    'group/drawer-content bg-background fixed z-50 flex h-auto flex-col',
    '[translate:var(--drawer-swipe-movement-x,0px)_var(--drawer-swipe-movement-y,0px)] data-swiping:will-change-[translate]',
    'transition-[translate] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-swiping:select-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:mb-24 data-[swipe-direction=up]:max-h-[80vh] data-[swipe-direction=up]:rounded-b-lg data-[swipe-direction=up]:data-[state=open]:slide-in-from-top data-[swipe-direction=up]:data-[state=closed]:slide-out-to-top',
    'data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:mt-24 data-[swipe-direction=down]:max-h-[80vh] data-[swipe-direction=down]:rounded-t-lg data-[swipe-direction=down]:data-[state=open]:slide-in-from-bottom data-[swipe-direction=down]:data-[state=closed]:slide-out-to-bottom',
    'data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:w-3/4 data-[swipe-direction=right]:sm:max-w-sm data-[swipe-direction=right]:data-[state=open]:slide-in-from-right data-[swipe-direction=right]:data-[state=closed]:slide-out-to-right',
    'data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-3/4 data-[swipe-direction=left]:sm:max-w-sm data-[swipe-direction=left]:data-[state=open]:slide-in-from-left data-[swipe-direction=left]:data-[state=closed]:slide-out-to-left',
    props.class,
  ),
)
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerContent data-slot="drawer-content" v-bind="{ ...$attrs, ...forwarded }" :class="contentClass">
      <DrawerHandle class="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[swipe-direction=down]/drawer-content:block" />
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
