<template>
  <a-form-item :label="label">
    <a-input-password v-model:value="model" :placeholder="placeholder" :maxlength="256" autocomplete="new-password" />
  </a-form-item>
</template>

<script setup lang="ts">
defineOptions({ name: 'SensitiveInput' })

const model = defineModel<string>()

defineProps<{
  label: string
  placeholder?: string
}>()
</script>
