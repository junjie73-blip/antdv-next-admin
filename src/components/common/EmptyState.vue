<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
  }>(),
  {
    title: '暂无数据',
    description: '',
    icon: 'ant-design:inbox-outlined',
  },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div
      class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-3xl text-gray-300"
    >
      <Icon :icon="icon" />
    </div>
    <p class="text-base font-medium text-gray-900">{{ title }}</p>
    <p v-if="description" class="mt-1 text-sm text-gray-500">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
