<script setup lang="ts">
import type { ComboboxEmptyProps } from "reka-ui"

import type { HTMLAttributes } from "vue"

import { cn } from '@antdv/shared/cn'
import { reactiveOmit } from "@vueuse/core"
import { ComboboxEmpty } from "reka-ui"

const props = defineProps<ComboboxEmptyProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <ComboboxEmpty
    data-slot="combobox-empty"
    v-bind="delegatedProps"
    :class="cn('py-6 text-center text-sm', props.class)"
  >
    <slot></slot>
  </ComboboxEmpty>
</template>
