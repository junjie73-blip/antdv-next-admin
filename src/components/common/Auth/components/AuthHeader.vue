<script setup lang="ts">
import { cn } from "~/utils/cn";

import { useAuthStyles } from "../composables/useAuthStyles";

defineOptions({ name: "AuthHeader" });

defineProps<{
  badgeText: string;
  title: string;
  subtitle: string;
  className?: string;
}>();

const { formHeaderBadgeClassName } = useAuthStyles();
</script>

<template>
  <div :class="cn('mb-8 text-center', className)">
    <span :class="formHeaderBadgeClassName">
      <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
      {{ badgeText }}
    </span>

    <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
      {{ title }}
    </h2>

    <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
      {{ subtitle }}
    </p>
  </div>
</template>
