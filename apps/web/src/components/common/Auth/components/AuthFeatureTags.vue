<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { cn } from '~/utils/cn';

import { useAuthStyles } from '../composables/useAuthStyles';

defineOptions({ name: 'AuthFeatureTags' });

defineProps<{
  features: AuthFeature[];
  className?: string;
}>();

export interface AuthFeature {
  icon: string;
  text: string;
}

const { brandFeatureClassName } = useAuthStyles();
</script>

<template>
  <div :class="cn('flex flex-wrap gap-2', className)">
    <span
      v-for="feature in features"
      :key="feature.text"
      :class="brandFeatureClassName"
    >
      <Icon :icon="feature.icon" class="h-3.5 w-3.5" />
      {{ feature.text }}
    </span>
  </div>
</template>
