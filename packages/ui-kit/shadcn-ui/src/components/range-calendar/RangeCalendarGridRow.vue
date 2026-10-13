<script lang="ts" setup>
import type { RangeCalendarGridRowProps } from "reka-ui"

import type { HTMLAttributes } from "vue"

import { cn } from '@antdv/shared/cn'
import { reactiveOmit } from "@vueuse/core"
import { RangeCalendarGridRow, useForwardProps } from "reka-ui"

const props = defineProps<RangeCalendarGridRowProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <RangeCalendarGridRow
    data-slot="range-calendar-grid-row"
    :class="cn('flex', props.class)" v-bind="forwardedProps"
  >
    <slot></slot>
  </RangeCalendarGridRow>
</template>
