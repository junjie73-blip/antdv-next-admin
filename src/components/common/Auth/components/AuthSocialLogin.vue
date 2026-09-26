<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { cn } from "~/utils/cn";

import { useAuthStyles } from "../composables/useAuthStyles";

defineOptions({ name: "AuthSocialLogin" });

export interface SocialItem {
  key: string;
  label: string;
  icon: string;
  /** Tailwind 颜色类，如 text-[#07C160] */
  iconClassName: string;
}

defineProps<{
  items: SocialItem[];
  className?: string;
}>();

const emit = defineEmits<{
  click: [key: string];
}>();

const { socialButtonClassName, socialIconClassName } = useAuthStyles();
</script>

<template>
  <div :class="cn('grid grid-cols-4 gap-2.5', className)">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      :class="socialButtonClassName"
      :title="`使用 ${item.label} 登录`"
      @click="emit('click', item.key)"
    >
      <Icon :icon="item.icon" :class="cn(socialIconClassName, item.iconClassName)" />
    </button>
  </div>
</template>
