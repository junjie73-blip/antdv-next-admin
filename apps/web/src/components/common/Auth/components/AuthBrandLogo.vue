<script setup lang="ts">
import { useAuthStyles } from '../composables/useAuthStyles';

defineOptions({ name: 'AuthBrandLogo' });

defineProps<{
  title: string;
  logo: string;
}>();

const { brandLogoClassName, brandLogoIconClassName } = useAuthStyles();
</script>

<template>
  <div :class="brandLogoClassName">
    <div :class="brandLogoIconClassName">
      <img :src="logo" :alt="title" class="h-full w-full object-contain" />
    </div>
    <span class="text-sm font-semibold tracking-wide">{{ title }}</span>
  </div>
</template>
