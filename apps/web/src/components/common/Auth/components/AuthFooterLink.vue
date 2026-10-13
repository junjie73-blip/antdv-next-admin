<script setup lang="ts">
import { cn } from '@antdv/shared/cn';
import { Button as AButton } from 'antdv-next';

defineOptions({ name: 'AuthFooterLink' });

defineProps<{
  text: string;
  actionText: string;
  className?: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'mt-5 text-center text-sm',
        'text-slate-500 dark:text-slate-400',
        className,
      )
    "
  >
    {{ text }}
    <AButton
      type="link"
      class="!text-ant-primary !h-auto !px-1 !font-medium"
      @click="emit('action')"
    >
      {{ actionText }}
    </AButton>
  </div>
</template>
