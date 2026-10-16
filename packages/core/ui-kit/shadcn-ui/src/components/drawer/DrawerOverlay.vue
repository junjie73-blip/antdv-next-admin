<script lang="ts" setup>
import type { DrawerOverlayProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DrawerOverlay } from "reka-ui"
import { cn } from '@antdv/shared/utils/cn'

const props = defineProps<DrawerOverlayProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <!--
    reka 的 DrawerOverlayImpl 在打开期间会 `document.body.style.pointerEvents = 'none'` 锁住背景，
    但它走的是 useBodyScrollLock 的 owner 记账，不是 DismissableLayer 的
    `layersWithOutsidePointerEventsDisabled` —— 所以 portal 到 body 的浮层（Popover/Select/
    DropdownMenu…）不会像在对话框里那样自动认领回 `pointer-events: auto`。
    那些浮层的 class 里都补了 `data-[state=open]:pointer-events-auto`，别删。
  -->
  <DrawerOverlay
    data-slot="drawer-overlay"
    v-bind="delegatedProps"
    :class="cn('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 duration-500', props.class)"
  />
</template>
