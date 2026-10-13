<script lang="ts" setup>
import type { DrawerTitleProps } from "reka-ui"

import type { HTMLAttributes } from "vue"

import { cn } from '@antdv/shared/cn'
import { reactiveOmit } from "@vueuse/core"
import { DrawerTitle } from "reka-ui"

const props = defineProps<DrawerTitleProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <DrawerTitle
    data-slot="drawer-title"
    v-bind="delegatedProps"
    :class="cn('text-foreground font-semibold', props.class)"
  >
    <slot></slot>
  </DrawerTitle>
</template>
