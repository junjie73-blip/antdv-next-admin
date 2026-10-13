<script setup lang="ts">
import type { NavigationMenuItemProps } from "reka-ui"

import type { HTMLAttributes } from "vue"

import { cn } from '@antdv/shared/cn'
import { reactiveOmit } from "@vueuse/core"
import { NavigationMenuItem } from "reka-ui"

const props = defineProps<NavigationMenuItemProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <NavigationMenuItem
    data-slot="navigation-menu-item"
    v-bind="delegatedProps"
    :class="cn('relative', props.class)"
  >
    <slot></slot>
  </NavigationMenuItem>
</template>
