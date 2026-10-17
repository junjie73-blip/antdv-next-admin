<script setup lang="ts">
import type { AuthSocialItem, AuthSocialLoginProps } from './types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

defineOptions({ name: 'AuthSocialLogin' });

const props = withDefaults(defineProps<AuthSocialLoginProps>(), {
  dividerText: '',
  items: () => [],
});

const emit = defineEmits<{
  select: [item: AuthSocialItem];
}>();
</script>

<template>
  <div v-if="props.items.length > 0" class="w-full" data-auth="social">
    <div
      v-if="props.dividerText"
      class="mt-4 flex items-center justify-between"
    >
      <span class="w-[35%] border-b border-input"></span>
      <span
        class="text-center text-xs tracking-widest text-muted-foreground uppercase"
      >
        {{ props.dividerText }}
      </span>
      <span class="w-[35%] border-b border-input"></span>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
      <button
        v-for="item in props.items"
        :key="item.value"
        :aria-label="item.label"
        :title="item.label"
        class="hover:text-primary hover:bg-primary/10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground/70 transition-colors"
        type="button"
        @click="emit('select', item)"
      >
        <Icon :icon="item.icon" class="size-[18px]" />
      </button>
    </div>
  </div>
</template>
