<script setup lang="ts">
import { cn } from "~/utils/cn";

defineOptions({ name: "AuthFooterLink" });

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
  <div :class="cn('mt-5 text-center text-sm', 'text-slate-500 dark:text-slate-400', className)">
    {{ text }}
    <a-button
      type="link"
      class="!h-auto !px-1 !font-medium !text-ant-primary"
      @click="emit('action')"
    >
      {{ actionText }}
    </a-button>
  </div>
</template>
