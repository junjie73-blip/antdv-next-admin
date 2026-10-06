<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { cn } from '~/utils/cn';

defineOptions({ name: 'AuthBrandStats' });

defineProps<{
  stats: AuthStat[];
  className?: string;
}>();

export interface AuthStat {
  icon: string;
  value: string;
  label: string;
}

</script>

<template>
  <div
    :class="
      cn('grid grid-cols-3 gap-3 pt-6', 'border-t border-white/10', className)
    "
  >
    <div v-for="stat in stats" :key="stat.label" class="flex flex-col gap-1">
      <Icon :icon="stat.icon" class="h-4 w-4 text-white/60" />
      <span
        class="text-lg font-semibold tracking-tight text-white tabular-nums"
      >
        {{ stat.value }}
      </span>
      <span class="text-[10px] tracking-wider text-white/50 uppercase">
        {{ stat.label }}
      </span>
    </div>
  </div>
</template>
