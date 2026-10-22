<script setup lang="ts">
import type { AuthFormPanelProps } from './types';

defineOptions({ name: 'AuthFormPanel' });

const props = withDefaults(defineProps<AuthFormPanelProps>(), {
  badge: '',
  description: '',
  title: '',
});
</script>

<template>
  <!--
    认证页表单列：`md:max-w-md` 是参考实现的收口宽度，窄屏靠外层 `px-5` 留出边距，
    所以这里只管"多宽"，不管"多高"——垂直居中与上下留白由 `AuthPageLayout` 的表单栏负责。
  -->
  <div class="w-full sm:mx-auto md:max-w-md" data-auth="form-panel">
    <div
      v-if="props.badge || props.title || props.description || $slots.extra"
      class="mb-7"
    >
      <span
        v-if="props.badge"
        class="border-primary/25 bg-primary/10 text-primary mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        data-auth="form-badge"
      >
        <span class="bg-primary size-1.5 rounded-full"></span>
        {{ props.badge }}
      </span>
      <h2
        v-if="props.title"
        class="text-foreground mb-3 text-3xl/9 font-bold tracking-tight lg:text-4xl"
        data-auth="form-title"
      >
        {{ props.title }}
      </h2>
      <p
        v-if="props.description"
        class="text-sm text-muted-foreground lg:text-base"
        data-auth="form-desc"
      >
        {{ props.description }}
      </p>
      <slot name="extra"></slot>
    </div>
    <slot></slot>
  </div>
</template>
