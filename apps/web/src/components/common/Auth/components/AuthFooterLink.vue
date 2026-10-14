<script setup lang="ts">
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

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
    <Button
      variant="link"
      class="h-auto px-1 font-medium"
      @click="emit('action')"
    >
      {{ actionText }}
    </Button>
  </div>
</template>
