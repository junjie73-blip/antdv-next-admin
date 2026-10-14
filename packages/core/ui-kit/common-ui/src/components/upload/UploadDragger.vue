<script setup lang="ts">
import Upload from './Upload.vue';

defineOptions({ name: 'UploadDragger', inheritAttrs: false });
</script>

<template>
  <Upload drag v-bind="$attrs">
    <slot></slot>
  </Upload>
</template>
