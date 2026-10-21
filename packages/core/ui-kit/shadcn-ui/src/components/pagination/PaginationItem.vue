<script setup lang="ts">
import type { PaginationListItemProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import type { ButtonVariants } from '../button';

import { cn } from '@antdv/shared/utils/cn';
import { reactiveOmit } from '@vueuse/core';
import { PaginationListItem } from 'reka-ui';

import { buttonVariants } from '../button';

const props = withDefaults(
  defineProps<
    PaginationListItemProps & {
      size?: ButtonVariants['size'];
      class?: HTMLAttributes['class'];
      isActive?: boolean;
    }
  >(),
  {
    size: 'icon',
  },
);

const delegatedProps = reactiveOmit(props, 'class', 'size', 'isActive');
</script>

<template>
  <PaginationListItem
    data-slot="pagination-item"
    v-bind="delegatedProps"
    :class="
      cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        props.class,
      )
    "
  >
    <slot></slot>
  </PaginationListItem>
</template>
