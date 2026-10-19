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

/** 字符串一律按 iconify 名解析，其余（Vue 组件）原样渲染 */
function isIconifyName(icon: AuthSocialItem['icon']): icon is string {
  return typeof icon === 'string';
}
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
        <Icon
          v-if="isIconifyName(item.icon)"
          :icon="item.icon"
          class="size-[18px]"
        />
        <component :is="item.icon" v-else class="size-[18px]" />
      </button>
    </div>
  </div>
</template>
